import { withTransaction } from '@/lib/db/transaction';
import { ChatRepository } from '@/lib/repositories/chat.repository';
import { DoctorsRepository } from '@/lib/repositories/doctors.repository';
import { HospitalsRepository } from '@/lib/repositories/hospitals.repository';
import type { SendMessageDto, AddReactionDto } from '@/lib/validations/chat.dto';
import { getDb } from '@/lib/db';
import { doctors, hospitals } from '@/src/db/drizzle/migrations/schema';
import { eq } from 'drizzle-orm';

export class ChatService {
  private chatRepo = new ChatRepository();
  private doctorsRepo = new DoctorsRepository();
  private hospitalsRepo = new HospitalsRepository();

  // Resolve doctor entity id from user id
  private async resolveDoctorId(userId: string): Promise<string> {
    const doctor = await this.doctorsRepo.findDoctorByUserId(userId);
    if (!doctor) throw Object.assign(new Error('Doctor profile not found'), { statusCode: 404 });
    return doctor.id;
  }

  // Resolve hospital entity id from user id
  private async resolveHospitalId(userId: string): Promise<string> {
    const hospital = await this.hospitalsRepo.findHospitalByUserId(userId);
    if (!hospital) throw Object.assign(new Error('Hospital profile not found'), { statusCode: 404 });
    return hospital.id;
  }

  // ─── Conversations ───────────────────────────────────────────────────────────

  async getOrCreateConversation(doctorId: string, hospitalId: string) {
    return withTransaction(async (tx) => {
      const existing = await this.chatRepo.findConversationByDoctorAndHospital(doctorId, hospitalId, tx);
      if (existing) {
        if (!existing.isActive) {
          await this.chatRepo.activateConversation(existing.id, tx);
          existing.isActive = true;
        }
        return { conversation: existing, created: false };
      }

      const conversation = await this.chatRepo.createConversation(doctorId, hospitalId, tx);
      return { conversation, created: true };
    });
  }

  async getConversationById(conversationId: string, userId: string, userRole: string) {
    const conversation = await this.chatRepo.findConversationById(conversationId);
    if (!conversation) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
    await this.verifyAccess(conversation, userId, userRole);
    return conversation;
  }

  async listConversations(userId: string, userRole: string, limit: number, cursor?: string) {
    if (userRole === 'doctor') {
      const doctorId = await this.resolveDoctorId(userId);
      return this.chatRepo.getConversationsForDoctor(doctorId, limit, cursor);
    } else if (userRole === 'hospital') {
      const hospitalId = await this.resolveHospitalId(userId);
      return this.chatRepo.getConversationsForHospital(hospitalId, limit, cursor);
    }
    throw Object.assign(new Error('Invalid user role for chat'), { statusCode: 403 });
  }

  async getTotalUnreadCount(userId: string, userRole: string) {
    if (userRole === 'doctor') {
      const doctorId = await this.resolveDoctorId(userId);
      return this.chatRepo.getTotalUnreadCount(doctorId, 'doctor');
    } else if (userRole === 'hospital') {
      const hospitalId = await this.resolveHospitalId(userId);
      return this.chatRepo.getTotalUnreadCount(hospitalId, 'hospital');
    }
    throw Object.assign(new Error('Invalid user role for chat'), { statusCode: 403 });
  }

  async deleteConversation(conversationId: string, userId: string, userRole: string) {
    const conversation = await this.chatRepo.findConversationById(conversationId);
    if (!conversation) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
    await this.verifyAccess(conversation, userId, userRole);
    return this.chatRepo.deleteConversation(conversationId);
  }

  // ─── Messages ────────────────────────────────────────────────────────────────

  async sendMessage(
    conversationId: string,
    userId: string,
    userRole: string,
    body: SendMessageDto
  ) {
    const conversation = await this.chatRepo.findConversationById(conversationId);
    if (!conversation) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });

    // Re-activate if deleted
    if (!conversation.isActive) {
      await this.chatRepo.activateConversation(conversationId);
      conversation.isActive = true;
    }

    const { senderId, senderType } = await this.resolveParty(userId, userRole, conversation);
    const receiverParty: 'doctor' | 'hospital' = senderType === 'doctor' ? 'hospital' : 'doctor';

    // Validate replyToId belongs to this conversation
    if (body.replyToId) {
      const replyMsg = await this.chatRepo.findMessageById(body.replyToId);
      if (!replyMsg || replyMsg.conversationId !== conversationId) {
        throw Object.assign(new Error('Reply target message not found in this conversation'), { statusCode: 400 });
      }
    }

    const result = await withTransaction(async (tx) => {
      const messageType = (body.attachmentIds && body.attachmentIds.length > 0) ? 'attachment' : (body.messageType ?? 'text');

      const message = await this.chatRepo.createMessage({
        conversationId,
        senderType,
        senderId,
        content: body.content,
        messageType,
        replyToId: body.replyToId ?? null,
      }, tx);

      // Link attachments if provided
      if (body.attachmentIds && body.attachmentIds.length > 0) {
        for (const fileId of body.attachmentIds) {
          const file = await this.chatRepo.findFileById(fileId, tx);
          if (!file) throw Object.assign(new Error(`File ${fileId} not found`), { statusCode: 400 });
          await this.chatRepo.createAttachment({
            messageId: message.id,
            conversationId,
            fileId,
            uploadedBy: senderType,
          }, tx);
        }
      }

      // Increment unread count for receiver
      await this.chatRepo.incrementUnreadCount(conversationId, receiverParty, tx);

      // Return enriched message with attachments
      const attachments = body.attachmentIds && body.attachmentIds.length > 0
        ? await this.chatRepo.getAttachmentsForMessage(message.id, tx)
        : [];
      return { ...message, attachments, reactions: [] };
    });

    // Fire-and-forget push notification to receiver (outside transaction)
    this.sendChatPushNotification(conversation, senderType, senderId, body.content).catch(() => {});

    return result;
  }

  async getMessages(conversationId: string, userId: string, userRole: string, limit: number, cursor?: string) {
    const conversation = await this.chatRepo.findConversationById(conversationId);
    if (!conversation) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
    await this.verifyAccess(conversation, userId, userRole);

    const result = await this.chatRepo.getMessages(conversationId, limit, cursor);
    const enriched = await this.enrichMessages(result.messages);

    // Side effect: Update statuses on fetch
    try {
      const { senderType: currentUserType } = await this.resolveParty(userId, userRole, conversation);
      const otherPartyType = currentUserType === 'doctor' ? 'hospital' : 'doctor';

      // 1. Current batch -> Delivered (if from other party)
      const otherMessagesIds = result.messages
        .filter((m: any) => m.senderType === otherPartyType && m.status < 2)
        .map((m: any) => m.id);
      
      // 2. Mark everything "delivered" and everything "older" as read
      await withTransaction(async (tx) => {
        if (otherMessagesIds.length > 0) {
          await this.chatRepo.markMessagesAsDelivered(otherMessagesIds, tx);
        }

        // Mark all messages before/including the latest one in this batch as read
        if (result.messages.length > 0) {
          const latestBatchDate = result.messages[0].createdAt;
          await this.chatRepo.markMessagesAsReadUpTo(conversationId, currentUserType, latestBatchDate, tx);
        }

        // Reset unread count for the current user
        await this.chatRepo.resetUnreadCount(conversationId, currentUserType, tx);
      });
    } catch (err) {
      console.error('Error updating status on fetch:', err);
      // Don't fail the GET request if status update fails
    }

    return { ...result, messages: enriched };
  }

  async markMessageAsRead(conversationId: string, messageId: string, userId: string, userRole: string) {
    const conversation = await this.chatRepo.findConversationById(conversationId);
    if (!conversation) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });

    const { senderType } = await this.resolveParty(userId, userRole, conversation);

    const message = await this.chatRepo.findMessageById(messageId);
    if (!message || message.conversationId !== conversationId) {
      throw Object.assign(new Error('Message not found'), { statusCode: 404 });
    }

    return withTransaction(async (tx) => {
      const updated = await this.chatRepo.markMessageAsRead(messageId, tx);
      await this.chatRepo.resetUnreadCount(conversationId, senderType, tx);
      return updated;
    });
  }

  async deleteMessage(conversationId: string, messageId: string, userId: string, userRole: string) {
    const conversation = await this.chatRepo.findConversationById(conversationId);
    if (!conversation) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });

    const { senderId } = await this.resolveParty(userId, userRole, conversation);

    const message = await this.chatRepo.findMessageById(messageId);
    if (!message || message.conversationId !== conversationId) {
      throw Object.assign(new Error('Message not found'), { statusCode: 404 });
    }
    if (message.senderId !== senderId) {
      throw Object.assign(new Error('You can only delete your own messages'), { statusCode: 403 });
    }
    if (message.isDeleted) {
      throw Object.assign(new Error('Message already deleted'), { statusCode: 400 });
    }

    return this.chatRepo.softDeleteMessage(messageId);
  }

  async editMessage(conversationId: string, messageId: string, content: string, userId: string, userRole: string) {
    const conversation = await this.chatRepo.findConversationById(conversationId);
    if (!conversation) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });

    const { senderId } = await this.resolveParty(userId, userRole, conversation);

    const message = await this.chatRepo.findMessageById(messageId);
    if (!message || message.conversationId !== conversationId) {
      throw Object.assign(new Error('Message not found'), { statusCode: 404 });
    }
    if (message.senderId !== senderId) {
      throw Object.assign(new Error('You can only edit your own messages'), { statusCode: 403 });
    }
    if (message.isDeleted) {
      throw Object.assign(new Error('Cannot edit a deleted message'), { statusCode: 400 });
    }

    return this.chatRepo.editMessage(messageId, content);
  }

  async updateMessagesStatus(conversationId: string, messageIds: string[], status: number, userId: string, userRole: string) {
    const conversation = await this.chatRepo.findConversationById(conversationId);
    if (!conversation) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });

    await this.resolveParty(userId, userRole, conversation);

    return withTransaction(async (tx) => {
      const updated = await this.chatRepo.updateMessagesStatus(messageIds, status, tx);
      if (status === 3) {
        const { senderType } = await this.resolveParty(userId, userRole, conversation);
        await this.chatRepo.resetUnreadCount(conversationId, senderType, tx);
      }
      return updated;
    });
  }

  // ─── Reactions ───────────────────────────────────────────────────────────────

  async toggleReaction(
    conversationId: string,
    messageId: string,
    userId: string,
    userRole: string,
    body: AddReactionDto
  ) {
    const conversation = await this.chatRepo.findConversationById(conversationId);
    if (!conversation) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });

    const { senderId: reactorId, senderType: reactorType } = await this.resolveParty(userId, userRole, conversation);

    const message = await this.chatRepo.findMessageById(messageId);
    if (!message || message.conversationId !== conversationId) {
      throw Object.assign(new Error('Message not found'), { statusCode: 404 });
    }

    return withTransaction(async (tx) => {
      const existing = await this.chatRepo.findReaction(messageId, reactorId, tx);

      if (existing) {
        if (existing.emoji === body.emoji) {
          await this.chatRepo.deleteReaction(existing.id, tx);
        } else {
          await this.chatRepo.updateReactionEmoji(existing.id, body.emoji, tx);
        }
      } else {
        await this.chatRepo.createReaction({
          messageId,
          conversationId,
          reactorType,
          reactorId,
          emoji: body.emoji,
        }, tx);
      }

      const reactions = await this.chatRepo.getReactionsForMessage(messageId, tx);
      return this.groupReactions(reactions);
    });
  }

  // ─── Attachments ─────────────────────────────────────────────────────────────

  async getMessageAttachments(messageId: string) {
    return this.chatRepo.getAttachmentsForMessage(messageId);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async resolveParty(
    userId: string,
    userRole: string,
    conversation: { doctorId: string; hospitalId: string }
  ): Promise<{ senderId: string; senderType: 'doctor' | 'hospital' }> {
    if (userRole === 'doctor') {
      const doctor = await this.doctorsRepo.findDoctorByUserId(userId);
      if (!doctor) throw Object.assign(new Error('Doctor profile not found'), { statusCode: 404 });
      if (doctor.id !== conversation.doctorId) {
        throw Object.assign(new Error('Unauthorized: not part of this conversation'), { statusCode: 403 });
      }
      return { senderId: doctor.id, senderType: 'doctor' };
    } else if (userRole === 'hospital') {
      const hospital = await this.hospitalsRepo.findHospitalByUserId(userId);
      if (!hospital) throw Object.assign(new Error('Hospital profile not found'), { statusCode: 404 });
      if (hospital.id !== conversation.hospitalId) {
        throw Object.assign(new Error('Unauthorized: not part of this conversation'), { statusCode: 403 });
      }
      return { senderId: hospital.id, senderType: 'hospital' };
    }
    throw Object.assign(new Error('Invalid user role'), { statusCode: 403 });
  }

  private async verifyAccess(
    conversation: { doctorId: string; hospitalId: string },
    userId: string,
    userRole: string
  ) {
    await this.resolveParty(userId, userRole, conversation);
  }

  private async enrichMessages(messages: any[]) {
    if (messages.length === 0) return [];

    const allIds = messages.map((m: any) => m.id);
    const attachmentMsgIds = messages.filter((m: any) => m.messageType === 'attachment').map((m: any) => m.id);
    const replyToIds = messages.map((m: any) => m.replyToId).filter(Boolean) as string[];

    const [allAttachments, allReactions, allReplies] = await Promise.all([
      this.chatRepo.getAttachmentsForMessages(attachmentMsgIds),
      this.chatRepo.getReactionsForMessages(allIds),
      replyToIds.length > 0 ? this.chatRepo.getMessagesByIds(replyToIds) : Promise.resolve([]),
    ]);

    // Group by messageId
    const attachmentsByMsg = new Map<string, any[]>();
    for (const att of allAttachments) {
      const list = attachmentsByMsg.get(att.messageId) || [];
      list.push(att);
      attachmentsByMsg.set(att.messageId, list);
    }

    const reactionsByMsg = new Map<string, any[]>();
    for (const r of allReactions) {
      const list = reactionsByMsg.get(r.messageId) || [];
      list.push(r);
      reactionsByMsg.set(r.messageId, list);
    }

    const repliesById = new Map<string, any>();
    for (const reply of allReplies) {
      repliesById.set(reply.id, {
        id: reply.id,
        content: reply.content,
        senderId: reply.senderId,
        senderType: reply.senderType,
        messageType: reply.messageType,
      });
    }

    return messages.map((msg: any) => ({
      ...msg,
      attachments: attachmentsByMsg.get(msg.id) || [],
      reactions: this.groupReactions(reactionsByMsg.get(msg.id) || []),
      replyTo: msg.replyToId ? (repliesById.get(msg.replyToId) || null) : null,
    }));
  }

  private groupReactions(reactions: any[]) {
    const grouped: Record<string, { emoji: string; count: number; reactors: string[] }> = {};
    for (const r of reactions) {
      if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, reactors: [] };
      grouped[r.emoji].count++;
      grouped[r.emoji].reactors.push(r.reactorId);
    }
    return Object.values(grouped);
  }

  private async sendChatPushNotification(
    conversation: { id: string; doctorId: string; hospitalId: string },
    senderType: 'doctor' | 'hospital',
    senderId: string,
    content: string
  ) {
    const db = getDb();

    let receiverUserId: string | null = null;
    let senderName = 'Someone';

    if (senderType === 'doctor') {
      // Sender is doctor → receiver is hospital
      const [senderRow] = await db.select({ firstName: doctors.firstName, lastName: doctors.lastName }).from(doctors).where(eq(doctors.id, senderId)).limit(1);
      if (senderRow) senderName = `${senderRow.firstName} ${senderRow.lastName}`.trim() || 'Doctor';

      const [receiverRow] = await db.select({ userId: hospitals.userId }).from(hospitals).where(eq(hospitals.id, conversation.hospitalId)).limit(1);
      receiverUserId = receiverRow?.userId ?? null;
    } else {
      // Sender is hospital → receiver is doctor
      const [senderRow] = await db.select({ name: hospitals.name }).from(hospitals).where(eq(hospitals.id, senderId)).limit(1);
      if (senderRow) senderName = senderRow.name ?? 'Hospital';

      const [receiverRow] = await db.select({ userId: doctors.userId }).from(doctors).where(eq(doctors.id, conversation.doctorId)).limit(1);
      receiverUserId = receiverRow?.userId ?? null;
    }

    if (!receiverUserId) return;

    const { NotificationsService } = await import('@/lib/services/notifications.service');
    const notificationsService = new NotificationsService();

    const deepLink = 'hospitalapp://chat';
    const truncatedContent = content.length > 100 ? content.substring(0, 100) + '...' : content;

    await notificationsService.sendPushNotification(receiverUserId, {
      userId: receiverUserId,
      recipientType: 'user',
      notificationType: 'chat',
      title: `New message from ${senderName}`,
      message: truncatedContent,
      channel: 'push',
      priority: 'medium',
      payload: {
        notificationType: 'chat_message',
        deepLink,
        conversationId: conversation.id,
      },
    });
  }
}
