'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Paperclip, X, Reply, Smile, Trash2, Edit2, Check, CheckCheck, ChevronLeft,
  MessageSquare, Search, Loader2, Download, Plus, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import apiClient from '@/lib/api/httpClient';
import { isAuthenticated, getUserRole, getUserId } from '@/lib/auth/utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  doctorId: string;
  hospitalId: string;
  lastMessageAt: string | null;
  doctorUnreadCount: number;
  hospitalUnreadCount: number;
  updatedAt: string;
  lastMessageContent?: string | null;
  lastMessageIsRead?: boolean | null;
  lastMessageSenderType?: string | null;
  // enriched fields
  hospitalName?: string | null;
  doctorFirstName?: string | null;
  doctorLastName?: string | null;
}

interface Attachment {
  id: string;
  fileId: string;
  filename: string | null;
  url: string | null;
  cdnUrl: string | null;
  mimetype: string | null;
  size: number | null;
  uploadedBy: string;
}

interface Reaction {
  emoji: string;
  count: number;
  reactors: string[];
}

interface Message {
  id: string;
  conversationId: string;
  senderType: 'doctor' | 'hospital';
  senderId: string;
  content: string;
  messageType: 'text' | 'attachment' | 'system';
  replyToId: string | null;
  isRead: boolean;
  readAt: string | null;
  isDeleted: boolean;
  isEdited: boolean;
  createdAt: string;
  attachments?: Attachment[];
  reactions?: Reaction[];
}

interface Contact {
  id: string;
  name: string;
  city: string | null;
  type: 'doctor' | 'hospital';
  logoId?: string | null;
  profilePhotoId?: string | null;
}

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// ─── Helper components ────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function isImage(mimetype: string | null) {
  return mimetype?.startsWith('image/') ?? false;
}

function isPdf(mimetype: string | null) {
  return mimetype === 'application/pdf';
}

function fileUrl(attachment: Attachment) {
  return attachment.cdnUrl || attachment.url || '';
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter();
  const userRole = getUserRole() as 'doctor' | 'hospital' | null;
  const userId = getUserId();

  const [myEntityId, setMyEntityId] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contactPage, setContactPage] = useState(1);
  const [contactTotalPages, setContactTotalPages] = useState(1);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Input state
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{ id: string; name: string }[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null); // messageId
  const [sending, setSending] = useState(false);
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null); // confirm dialog

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    fetchConversations();
    fetchMyEntityId();
  }, []);

  const fetchMyEntityId = async () => {
    try {
      const profilePath = userRole === 'doctor' ? '/api/doctors/profile' : '/api/hospitals/profile';
      const res = await apiClient.get(profilePath);
      if (res.data.success) setMyEntityId(res.data.data.id);
    } catch { /* silent */ }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll conversation list every 10s for new messages / unread counts
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Poll active conversation messages every 5s
  const activeConvRef = useRef<string | null>(null);
  useEffect(() => {
    activeConvRef.current = activeConv?.id ?? null;
  }, [activeConv]);

  useEffect(() => {
    if (!activeConv) return;
    const interval = setInterval(async () => {
      if (!activeConvRef.current) return;
      try {
        const res = await apiClient.get(`/api/chats/${activeConvRef.current}/messages?limit=50`);
        if (res.data.success) {
          setMessages(res.data.data.messages);
          // Mark unread
          const unread = res.data.data.messages.filter((m: Message) => !m.isRead && m.senderType !== userRole);
          if (unread.length > 0) {
            markAsRead(activeConvRef.current!, unread[unread.length - 1].id);
          }
        }
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeConv?.id]);

  // Debounce contact search
  useEffect(() => {
    if (!showNewChat) return;
    const t = setTimeout(() => fetchContacts(contactSearch, 1), 300);
    return () => clearTimeout(t);
  }, [contactSearch, showNewChat]);

  // ─── API calls ──────────────────────────────────────────────────────────────

  const fetchConversations = async (silent = false) => {
    try {
      if (!silent) setConvLoading(true);
      const res = await apiClient.get('/api/chats?limit=50');
      if (res.data.success) {
        setConversations(res.data.data.conversations || []);
      }
    } catch {
      if (!silent) toast.error('Failed to load conversations');
    } finally {
      if (!silent) setConvLoading(false);
    }
  };

  const fetchContacts = async (search = '', page = 1) => {
    try {
      setContactsLoading(true);
      const params = new URLSearchParams({ limit: '20', page: String(page) });
      if (search) params.set('search', search);
      const res = await apiClient.get(`/api/chats/contacts?${params}`);
      if (res.data.success) {
        setContacts(page === 1 ? res.data.data : prev => [...prev, ...res.data.data]);
        setContactTotalPages(res.data.pagination.totalPages);
        setContactPage(page);
      }
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setContactsLoading(false);
    }
  };

  const openNewChat = () => {
    setShowNewChat(true);
    setContactSearch('');
    setContactPage(1);
    fetchContacts('', 1);
  };

  const startNewConversation = async (contact: Contact) => {
    if (startingChat) return;
    try {
      setStartingChat(contact.id);
      const body = userRole === 'doctor'
        ? { doctorId: myEntityId, hospitalId: contact.id }
        : { doctorId: contact.id, hospitalId: myEntityId };

      const res = await apiClient.post('/api/chats', body);
      if (res.data.success) {
        setShowNewChat(false);
        await fetchConversations();
        // Find and open the conversation
        const conv = res.data.data;
        openConversation(conv);
      }
    } catch {
      toast.error('Failed to start conversation');
    } finally {
      setStartingChat(null);
    }
  };

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setMessages([]);
    setNextCursor(null);
    setReplyTo(null);
    setEditingMsg(null);
    setText('');
    await fetchMessages(conv.id, null);
  };

  const fetchMessages = async (convId: string, cursor: string | null) => {
    try {
      setMsgLoading(true);
      const url = cursor
        ? `/api/chats/${convId}/messages?limit=50&cursor=${encodeURIComponent(cursor)}`
        : `/api/chats/${convId}/messages?limit=50`;
      const res = await apiClient.get(url);
      if (res.data.success) {
        const { messages: msgs, hasMore: more, nextCursor: nc } = res.data.data;
        setMessages(prev => cursor ? [...msgs, ...prev] : msgs);
        setHasMore(more);
        setNextCursor(nc);
        // Mark last unread message as read
        const unread = msgs.filter((m: Message) => !m.isRead && m.senderType !== userRole);
        if (unread.length > 0) {
          markAsRead(convId, unread[unread.length - 1].id);
        }
      }
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setMsgLoading(false);
    }
  };

  const markAsRead = async (convId: string, msgId: string) => {
    try {
      await apiClient.patch(`/api/chats/${convId}/messages/${msgId}/read`);
      // Update local unread count
      setConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        return { ...c, doctorUnreadCount: userRole === 'doctor' ? 0 : c.doctorUnreadCount, hospitalUnreadCount: userRole === 'hospital' ? 0 : c.hospitalUnreadCount };
      }));
    } catch { /* silent */ }
  };

  const sendMessage = async () => {
    if ((!text.trim() && pendingFiles.length === 0) || !activeConv || sending) return;
    try {
      setSending(true);
      const body: any = {
        content: text.trim() || (pendingFiles.length > 0 ? `${pendingFiles.length} file(s) attached` : ''),
        messageType: pendingFiles.length > 0 ? 'attachment' : 'text',
      };
      if (replyTo) body.replyToId = replyTo.id;
      if (pendingFiles.length > 0) body.attachmentIds = pendingFiles.map(f => f.id);

      const res = await apiClient.post(`/api/chats/${activeConv.id}/messages`, body);
      if (res.data.success) {
        setMessages(prev => [...prev, res.data.data]);
        setText('');
        setReplyTo(null);
        setPendingFiles([]);
        // Refresh conversation list to update lastMessageAt
        fetchConversations();
      }
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const saveEdit = async () => {
    if (!editingMsg || !text.trim() || !activeConv) return;
    try {
      const res = await apiClient.patch(`/api/chats/${activeConv.id}/messages/${editingMsg.id}`, { content: text.trim() });
      if (res.data.success) {
        setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, content: text, isEdited: true } : m));
        setEditingMsg(null);
        setText('');
      }
    } catch {
      toast.error('Failed to edit message');
    }
  };

  const deleteMessage = async (msg: Message) => {
    if (!activeConv) return;
    try {
      await apiClient.delete(`/api/chats/${activeConv.id}/messages/${msg.id}`);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isDeleted: true, content: '[deleted]' } : m));
    } catch {
      toast.error('Failed to delete message');
    }
  };

  const deleteConversation = async (conv: Conversation) => {
    try {
      await apiClient.delete(`/api/chats/${conv.id}`);
      setConversations(prev => prev.filter(c => c.id !== conv.id));
      if (activeConv?.id === conv.id) setActiveConv(null);
      toast.success('Conversation deleted');
    } catch {
      toast.error('Failed to delete conversation');
    } finally {
      setDeletingConvId(null);
    }
  };

  const toggleReaction = async (msg: Message, emoji: string) => {
    if (!activeConv) return;
    try {
      const res = await apiClient.post(`/api/chats/${activeConv.id}/messages/${msg.id}/reactions`, { emoji });
      if (res.data.success) {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: res.data.data.reactions ?? [] } : m));
      }
    } catch { /* silent */ }
    setShowEmojiPicker(null);
  };

  const uploadFiles = async (fileList: FileList) => {
    if (!activeConv) return;
    
    const files = Array.from(fileList);
    if (files.length > 10) {
      toast.error('Maximum 10 files allowed');
      return;
    }
    
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File ${file.name} is too large. Maximum size is 25MB.`);
        return;
      }
    }

    try {
      setUploadingFile(true);
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));

      const res = await apiClient.post(`/api/chats/${activeConv.id}/attachments/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        // res.data.data is now just an array of IDs: ['id1', 'id2']
        const uploadedIds: string[] = res.data.data;
        const uploaded = uploadedIds.map((id, index) => ({
          id,
          name: files[index]?.name || `Attachment ${index + 1}`,
        }));
        setPendingFiles(prev => [...prev, ...uploaded]);
        toast.success(`${files.length} file(s) ready to send`);
      }
    } catch {
      toast.error('Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  const startEdit = (msg: Message) => {
    setEditingMsg(msg);
    setText(msg.content);
    setReplyTo(null);
    textareaRef.current?.focus();
  };

  const cancelEdit = () => {
    setEditingMsg(null);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingMsg) saveEdit(); else sendMessage();
    }
    if (e.key === 'Escape') {
      if (editingMsg) cancelEdit();
      if (replyTo) setReplyTo(null);
    }
  };

  // ─── Derived data ────────────────────────────────────────────────────────────

  const myParty = userRole as 'doctor' | 'hospital';
  const otherParty = myParty === 'doctor' ? 'hospital' : 'doctor';

  function convName(conv: Conversation) {
    if (myParty === 'doctor') return conv.hospitalName ?? 'Hospital';
    return `Dr. ${conv.doctorFirstName ?? ''} ${conv.doctorLastName ?? ''}`.trim() || 'Doctor';
  }

  function convInitial(conv: Conversation) {
    return convName(conv).charAt(0).toUpperCase();
  }

  function myUnread(conv: Conversation) {
    return myParty === 'doctor' ? conv.doctorUnreadCount : conv.hospitalUnreadCount;
  }

  function isMine(msg: Message) {
    return msg.senderType === myParty;
  }

  const filteredConvs = conversations.filter(c => {
    if (!searchQuery) return true;
    return convName(c).toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  messages.forEach(msg => {
    const d = new Date(msg.createdAt);
    const label = formatDate(msg.createdAt);
    const last = groupedMessages[groupedMessages.length - 1];
    if (!last || last.date !== label) {
      groupedMessages.push({ date: label, msgs: [msg] });
    } else {
      last.msgs.push(msg);
    }
  });

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-48px)] bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">

      {/* ── Delete Conversation Confirmation Dialog ───────────────────────────── */}
      {deletingConvId && (() => {
        const conv = conversations.find(c => c.id === deletingConvId);
        if (!conv) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="font-semibold text-slate-800">Delete Conversation</h3>
              </div>
              <p className="text-sm text-slate-500 mb-5">
                Are you sure you want to delete your conversation with <span className="font-medium text-slate-700">{convName(conv)}</span>? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingConvId(null)}
                  className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteConversation(conv)}
                  className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Left: Conversations List ─────────────────────────────────────────── */}
      <div className={`flex flex-col border-r border-slate-200 bg-slate-50 ${activeConv ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-shrink-0`}>
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800">Messages</h2>
            <button
              onClick={openNewChat}
              className="p-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white transition-colors"
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-white border-slate-200 text-sm"
            />
          </div>
        </div>

        {/* New Chat Panel */}
        {showNewChat && (
          <div className="border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-700">
                New {myParty === 'doctor' ? 'Hospital' : 'Doctor'} Chat
              </span>
              <button onClick={() => setShowNewChat(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="px-3 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  placeholder={`Search ${myParty === 'doctor' ? 'hospitals' : 'doctors'}...`}
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {contactsLoading && contacts.length === 0 ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
                </div>
              ) : contacts.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4 px-3">
                  No {myParty === 'doctor' ? 'hospitals' : 'doctors'} found
                </p>
              ) : (
                <>
                  {contacts.map(contact => (
                    <button
                      key={contact.id}
                      onClick={() => startNewConversation(contact)}
                      disabled={startingChat === contact.id}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left disabled:opacity-60"
                    >
                      <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-semibold text-xs flex-shrink-0">
                        {contact.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{contact.name}</p>
                        {contact.city && <p className="text-xs text-slate-400 truncate">{contact.city}</p>}
                      </div>
                      {startingChat === contact.id && <Loader2 className="w-4 h-4 animate-spin text-teal-500 flex-shrink-0" />}
                    </button>
                  ))}
                  {contactPage < contactTotalPages && (
                    <button
                      onClick={() => fetchContacts(contactSearch, contactPage + 1)}
                      disabled={contactsLoading}
                      className="w-full text-xs text-teal-600 hover:underline py-2 disabled:opacity-50"
                    >
                      {contactsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Load more'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {convLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <MessageSquare className="w-10 h-10 opacity-30" />
              <p className="text-sm">No conversations yet</p>
              <button
                onClick={openNewChat}
                className="mt-2 px-4 py-2 text-sm bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
              >
                Start a conversation
              </button>
            </div>
          ) : (
            filteredConvs.map(conv => {
              const unread = myUnread(conv);
              const isActive = activeConv?.id === conv.id;
              const preview = conv.lastMessageContent
                ? (conv.lastMessageContent.length > 40 ? conv.lastMessageContent.slice(0, 40) + '…' : conv.lastMessageContent)
                : (conv.lastMessageAt ? 'Tap to view messages' : 'No messages yet');
              return (
                <div
                  key={conv.id}
                  className={`group relative flex items-center gap-3 px-4 py-3 hover:bg-white border-b border-slate-100 transition-colors cursor-pointer ${isActive ? 'bg-white shadow-sm' : ''}`}
                  onClick={() => openConversation(conv)}
                >
                  <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    {convInitial(conv)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium truncate ${unread > 0 ? 'text-slate-900' : 'text-slate-700'}`}>
                        {convName(conv)}
                      </span>
                      {conv.lastMessageAt && (
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        {/* Tick for MY last message: ✓✓ read, ✓ unread */}
                        {conv.lastMessageSenderType === myParty && conv.lastMessageContent && (
                          conv.lastMessageIsRead
                            ? <CheckCheck className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                            : <Check className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        )}
                        <span className={`text-xs truncate ${unread > 0 ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                          {preview}
                        </span>
                      </div>
                      {unread > 0 && (
                        <span className="bg-teal-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Delete button — appears on hover */}
                  <button
                    onClick={e => { e.stopPropagation(); setDeletingConvId(conv.id); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 transition-all"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: Chat Window ───────────────────────────────────────────────── */}
      {activeConv ? (
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
            <button
              onClick={() => setActiveConv(null)}
              className="md:hidden p-1 rounded hover:bg-slate-100"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-semibold text-sm">
              {convInitial(activeConv)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-800 text-sm">{convName(activeConv)}</div>
              <div className="text-xs text-slate-400 capitalize">{otherParty}</div>
            </div>
            <button
              onClick={() => setDeletingConvId(activeConv.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
              title="Delete conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-slate-50">
            {hasMore && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={() => fetchMessages(activeConv.id, nextCursor)}
                  disabled={msgLoading}
                  className="text-xs text-teal-600 hover:underline"
                >
                  {msgLoading ? 'Loading...' : 'Load older messages'}
                </button>
              </div>
            )}

            {msgLoading && messages.length === 0 && (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
              </div>
            )}

            {groupedMessages.map(({ date, msgs }) => (
              <div key={date}>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 px-2">{date}</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {msgs.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMine={isMine(msg)}
                    messages={messages}
                    onReply={() => { setReplyTo(msg); textareaRef.current?.focus(); }}
                    onEdit={() => startEdit(msg)}
                    onDelete={() => deleteMessage(msg)}
                    onReact={(emoji) => toggleReaction(msg, emoji)}
                    showEmojiPicker={showEmojiPicker === msg.id}
                    onToggleEmojiPicker={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                  />
                ))}
              </div>
            ))}

            {messages.length === 0 && !msgLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                <MessageSquare className="w-10 h-10 opacity-30" />
                <p className="text-sm">No messages yet. Say hello!</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-slate-200 bg-white space-y-2">
            {/* Reply or Edit context bar */}
            {replyTo && (
              <div className="flex items-center gap-2 bg-teal-50 border-l-4 border-teal-400 px-3 py-2 rounded-r-lg">
                <Reply className="w-4 h-4 text-teal-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-teal-700">
                    Replying to {replyTo.senderType === myParty ? 'yourself' : convName(activeConv)}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{replyTo.content}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-teal-100 rounded">
                  <X className="w-3.5 h-3.5 text-teal-600" />
                </button>
              </div>
            )}
            {editingMsg && (
              <div className="flex items-center gap-2 bg-amber-50 border-l-4 border-amber-400 px-3 py-2 rounded-r-lg">
                <Edit2 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-amber-700">Editing message</p>
                  <p className="text-xs text-slate-500 truncate">{editingMsg.content}</p>
                </div>
                <button onClick={cancelEdit} className="p-1 hover:bg-amber-100 rounded">
                  <X className="w-3.5 h-3.5 text-amber-600" />
                </button>
              </div>
            )}

            {/* Pending file indicator */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 bg-slate-100 px-3 py-2 rounded-lg">
                {pendingFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                    <Paperclip className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="text-xs text-slate-600 max-w-[150px] truncate">{file.name}</span>
                    <button 
                      onClick={() => setPendingFiles(prev => prev.filter(f => f.id !== file.id))} 
                      className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              {/* File attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors flex-shrink-0 self-end mb-0.5"
                title="Attach file"
              >
                {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }}
              />

              {/* Text input */}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-slate-50 max-h-32 overflow-y-auto"
                style={{ lineHeight: '1.5' }}
              />

              {/* Send button */}
              <button
                onClick={editingMsg ? saveEdit : sendMessage}
                disabled={sending || (!text.trim() && pendingFiles.length === 0)}
                className="p-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 self-end"
                title={editingMsg ? 'Save edit' : 'Send message'}
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : editingMsg ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state — no conversation selected */
        <div className="hidden md:flex flex-1 items-center justify-center bg-slate-50">
          <div className="text-center text-slate-400">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm mt-1">Choose from the list to start messaging</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface MessageBubbleProps {
  msg: Message;
  isMine: boolean;
  messages: Message[];
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  showEmojiPicker: boolean;
  onToggleEmojiPicker: () => void;
}

function MessageBubble({ msg, isMine, messages, onReply, onEdit, onDelete, onReact, showEmojiPicker, onToggleEmojiPicker }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);

  const replyTarget = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null;

  if (msg.isDeleted) {
    return (
      <div className={`flex mb-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
        <span className="text-xs text-slate-400 italic px-3 py-2 bg-slate-100 rounded-xl">
          This message was deleted
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex mb-2 group ${isMine ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); }}
    >
      <div className={`flex flex-col max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
        {/* Reply reference */}
        {replyTarget && (
          <div className={`text-xs px-3 py-1.5 mb-1 rounded-lg border-l-2 bg-slate-50 border-slate-300 max-w-full ${isMine ? 'ml-auto' : ''}`}>
            <span className="font-medium text-slate-500 block truncate">
              {replyTarget.senderType === (isMine ? 'doctor' : 'hospital') ? 'You' : 'Them'}
            </span>
            <span className="text-slate-400 truncate block">{replyTarget.content}</span>
          </div>
        )}

        <div className={`relative flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
          {/* Action buttons */}
          {showActions && (
            <div className={`flex items-center gap-1 ${isMine ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={onReply}
                className="p-1.5 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-50 text-slate-500"
                title="Reply"
              >
                <Reply className="w-3.5 h-3.5" />
              </button>
              <div className="relative">
                <button
                  onClick={onToggleEmojiPicker}
                  className="p-1.5 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-50 text-slate-500"
                  title="React"
                >
                  <Smile className="w-3.5 h-3.5" />
                </button>
                {showEmojiPicker && (
                  <div className={`absolute bottom-8 z-10 bg-white shadow-lg border border-slate-200 rounded-xl p-2 flex gap-1.5 ${isMine ? 'right-0' : 'left-0'}`}>
                    {EMOJI_LIST.map(e => (
                      <button
                        key={e}
                        onClick={() => onReact(e)}
                        className="text-lg hover:scale-125 transition-transform"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isMine && !msg.isDeleted && (
                <>
                  {msg.messageType === 'text' && (
                    <button
                      onClick={onEdit}
                      className="p-1.5 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-50 text-slate-500"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={onDelete}
                    className="p-1.5 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-red-50 text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Bubble */}
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
              isMine
                ? 'bg-teal-500 text-white rounded-br-sm'
                : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
            }`}
          >
            {/* Attachments */}
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="mb-2 space-y-2">
                {msg.attachments.map(att => (
                  <AttachmentPreview key={att.id} att={att} isMine={isMine} />
                ))}
              </div>
            )}
            {/* Text */}
            {msg.content && msg.messageType !== 'attachment' && (
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            )}
            {msg.messageType === 'attachment' && msg.content && msg.content !== '[deleted]' && msg.content !== 'File attached' && (
              <p className="whitespace-pre-wrap break-words mt-1">{msg.content}</p>
            )}

            {/* Meta */}
            <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
              <span className={`text-xs ${isMine ? 'text-teal-100' : 'text-slate-400'}`}>
                {formatTime(msg.createdAt)}
              </span>
              {msg.isEdited && (
                <span className={`text-xs ${isMine ? 'text-teal-200' : 'text-slate-400'}`}>(edited)</span>
              )}
              {isMine && (
                msg.isRead
                  ? <CheckCheck className={`w-3.5 h-3.5 text-teal-100`} />
                  : <Check className={`w-3 h-3 text-teal-200 opacity-70`} />
              )}
            </div>
          </div>
        </div>

        {/* Reactions */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className={`flex gap-1 mt-1 flex-wrap ${isMine ? 'justify-end' : 'justify-start'}`}>
            {msg.reactions.map(r => (
              <span
                key={r.emoji}
                className="text-xs bg-white border border-slate-200 rounded-full px-2 py-0.5 shadow-sm"
              >
                {r.emoji} {r.count > 1 && r.count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Attachment Preview ───────────────────────────────────────────────────────

function AttachmentPreview({ att, isMine }: { att: Attachment; isMine: boolean }) {
  const url = fileUrl(att);
  if (!url) return null;

  if (isImage(att.mimetype)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt={att.filename ?? 'Image'}
          className="max-w-[200px] max-h-[180px] rounded-lg object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isMine ? 'bg-teal-600' : 'bg-slate-100'}`}
    >
      <Download className={`w-4 h-4 flex-shrink-0 ${isMine ? 'text-white' : 'text-slate-500'}`} />
      <span className={`text-xs truncate max-w-[150px] ${isMine ? 'text-white' : 'text-slate-700'}`}>
        {att.filename ?? 'File'}
      </span>
    </a>
  );
}
