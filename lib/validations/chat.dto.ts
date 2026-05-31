import { z } from 'zod';

export const CreateConversationDtoSchema = z.object({
  doctorId: z.string().uuid('Invalid doctor ID'),
  hospitalId: z.string().uuid('Invalid hospital ID'),
});

export const SendMessageDtoSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty').max(5000, 'Message too long'),
  messageType: z.enum(['text', 'attachment']).default('text'),
  replyToId: z.string().uuid().nullable().optional(),
  attachmentIds: z.array(z.string().uuid()).max(10).optional(),
});

export const EditMessageDtoSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty').max(5000, 'Message too long'),
});

export const AddReactionDtoSchema = z.object({
  emoji: z.string().min(1).max(10, 'Emoji too long'),
});

export const UpdateMessagesStatusDtoSchema = z.object({
  messageIds: z.array(z.string().uuid()),
  status: z.number().int().min(1).max(3),
});

export type CreateConversationDto = z.infer<typeof CreateConversationDtoSchema>;
export type SendMessageDto = z.infer<typeof SendMessageDtoSchema>;
export type EditMessageDto = z.infer<typeof EditMessageDtoSchema>;
export type AddReactionDto = z.infer<typeof AddReactionDtoSchema>;
export type UpdateMessagesStatusDto = z.infer<typeof UpdateMessagesStatusDtoSchema>;
