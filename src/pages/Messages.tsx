import { useEffect, useState, useRef } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { getUserRole } from "@/lib/auth";
import { Edit3, Trash2, Smile, PlusCircle, Check, X, Bell, BellOff } from "lucide-react";

interface Conversation {
  id: string;
  subject?: string | null;
  last_message_at?: string | null;
  is_group?: boolean;
  created_by?: string | null;
  muted?: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited?: boolean;
  deleted?: boolean;
}

interface ProfileMini {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
}

interface ParticipantRow {
  conversation_id: string;
  user_id?: string;
  muted?: boolean | null;
}

interface ConversationRow extends Conversation {}

interface MessageRow extends Message {
  attachment_id?: string | null;
}

interface AttachmentRow {
  id: string;
  storage_path: string;
  url: string;
  mime_type: string;
  size: number;
}

interface ReactionRow {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}
export default function Messages() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<ProfileMini[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [reactions, setReactions] = useState<Record<string, Array<{ user_id: string; emoji: string }>>>({});
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<{ id: string; url: string; mime: string } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, { id: string; url: string; mime: string; size: number }>>({});

  useEffect(() => {
    void loadUserAndConversations();
    void loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected) loadMessages(selected.id);
  }, [selected]);

  const loadUserAndConversations = async (): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const role = await getUserRole(user.id);
      setUserRole(role);

      // fetch participant rows for user, then load conversations
      const { data: parts, error: partsError } = await supabase
        .from<ParticipantRow>("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (partsError) throw partsError;

      const conversationIds = (parts || []).map((p) => p.conversation_id);
      if (conversationIds.length === 0) {
        setConversations([]);
        return;
      }

      const { data: convs, error: convsError } = await supabase
        .from<ConversationRow>("conversations")
        .select("*")
        .in("id", conversationIds)
        .order("last_message_at", { ascending: false, nulls_first: false });

      if (convsError) throw convsError;

      // fetch participant rows to read muted flag for current user
      const { data: partsForUser } = await supabase.from<ParticipantRow>("conversation_participants").select("conversation_id, muted").in("conversation_id", conversationIds).eq("user_id", user.id);
      const mutedMap: Record<string, boolean> = {};
      (partsForUser || []).forEach((p) => { mutedMap[p.conversation_id] = !!p.muted; });

      setConversations((convs || []).map((c) => ({ ...c, muted: !!mutedMap[c.id] })));
      if ((convs || []).length > 0) setSelected(convs[0]);
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Failed to load conversations", description: error?.message });
    }
  };

  const loadProfiles = async () => {
    try {
      const { data } = await supabase.from("profiles").select("id, first_name, last_name, avatar_url").order("first_name", { ascending: true });
      setProfiles(data || []);
    } catch (e) {
      // ignore
    }
  };

  // helper: compress image if needed (resize to max width 1280)
  const compressImage = async (file: File): Promise<Blob> => {
    const img = await createImageBitmap(file);
    const maxW = 1280;
    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(img, 0, 0, w, h);

    return await new Promise<Blob>((res, rej) => {
      canvas.toBlob((blob) => { if (blob) res(blob); else rej(new Error('Compression failed')); }, 'image/jpeg', 0.8);
    });
  };

  const uploadAttachment = async (file: File) => {
    if (!userId) return null;
    try {
      setUploadingAttachment(true);
      let uploadFile: Blob | File = file;
      if (file.type.startsWith('image/') && file.size > 300 * 1024) {
        // compress
        uploadFile = await compressImage(file);
      }

      const ext = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${ext}`;
      const filePath = `message-attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('message-attachments').upload(filePath, uploadFile as unknown as File, { upsert: false });
      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from('message-attachments').getPublicUrl(filePath).data.publicUrl;

      const { data: attachData, error: attachError } = await supabase.from<AttachmentRow>('message_attachments').insert({ storage_path: filePath, url: publicUrl, mime_type: file.type, size: file.size, uploaded_by: userId }).select('*').single();
      if (attachError) throw attachError;
      const att = attachData as AttachmentRow;
      setPendingAttachment({ id: att.id, url: att.url, mime: att.mime_type });
      return att;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: e?.message });
      return null;
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // basic validation
    const maxVideo = 50 * 1024 * 1024; // 50MB
    if (file.type.startsWith('video/') && file.size > maxVideo) { toast({ variant: 'destructive', title: 'File too large', description: 'Max 50MB for video' }); return; }
    if (file.type.startsWith('image/') && file.size > 10 * 1024 * 1024) { toast({ variant: 'destructive', title: 'File too large', description: 'Max 10MB for image' }); return; }
    await uploadAttachment(file);
  };

  const toggleMuteConversation = async (conversationId: string, mute: boolean) => {
    if (!userId) return;
    try {
      await supabase.from('conversation_participants').upsert({ conversation_id: conversationId, user_id: userId, muted: mute }, { onConflict: ['conversation_id', 'user_id'] });
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, muted: mute } : c));
    } catch (e) { }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data || []) as MessageRow[]);
      // mark as read: update participant.last_read_at
      if (userId) {
        await supabase
          .from("conversation_participants")
          .upsert({ conversation_id: conversationId, user_id: userId, last_read_at: new Date().toISOString() }, { onConflict: ["conversation_id", "user_id"] });
      }
      // load reactions for these messages
      const messageIds = (data || []).map((m: MessageRow) => m.id);
      if (messageIds.length > 0) {
        const { data: reacts } = await supabase.from<ReactionRow>("message_reactions").select("*").in("message_id", messageIds);
        const map: Record<string, Array<{ user_id: string; emoji: string }>> = {};
        (reacts || []).forEach((r) => {
          map[r.message_id] = map[r.message_id] || [];
          map[r.message_id].push({ user_id: r.user_id, emoji: r.emoji });
        });
        setReactions(map);
      } else {
        setReactions({});
      }
      // load attachments
      const attachmentIds = (data || []).map((m: MessageRow) => m.attachment_id).filter(Boolean) as string[];
      if (attachmentIds.length > 0) {
        const { data: attaches } = await supabase.from<AttachmentRow>("message_attachments").select("*").in("id", attachmentIds);
        const am: Record<string, AttachmentRow> = {};
        (attaches || []).forEach((a) => { if (a) am[a.id] = a; });
        const mapByMessage: Record<string, AttachmentRow> = {};
        (data || []).forEach((m: MessageRow) => { if (m.attachment_id) mapByMessage[m.id] = am[m.attachment_id]; });
        setAttachmentsMap(mapByMessage as any);
      } else {
        setAttachmentsMap({});
      }
      // scroll to bottom
      setTimeout(() => scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" }), 50);
    } catch (error: unknown) {
      console.error(error);
      const msg = (error as any)?.message || String(error);
      toast({ variant: "destructive", title: "Failed to load messages", description: msg });
    }
  };

  const handleSend = async () => {
    if (!selected || !userId || (!text.trim() && !pendingAttachment)) return;
    try {
      const payload: Partial<MessageRow> = { conversation_id: selected.id, sender_id: userId, content: text.trim() };
      if (pendingAttachment) payload.attachment_id = pendingAttachment.id;
      const { error } = await supabase.from("messages").insert(payload);
      if (error) throw error;
      setText("");
      setPendingAttachment(null);
      await loadMessages(selected.id);
    } catch (error: unknown) {
      console.error(error);
      const msg = (error as any)?.message || String(error);
      toast({ variant: "destructive", title: "Failed to send message", description: msg });
    }
  };

  const createDirectConversation = async (otherUserId: string) => {
    if (!userId || !otherUserId || userId === otherUserId) return;
    try {
      // check existing 1:1 conversation
      const { data: existingParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .in("user_id", [userId, otherUserId]);

      const grouped: Record<string, number> = {};
      (existingParts || []).forEach((p: any) => { grouped[p.conversation_id] = (grouped[p.conversation_id] || 0) + 1; });
      const match = Object.keys(grouped).find((cid) => grouped[cid] === 2);
      if (match) {
        // open existing
        const { data: conv } = await supabase.from("conversations").select("*").eq("id", match).single();
        setSelected(conv as any);
        return;
      }

      // create conversation
      const { data: convData, error: convError } = await supabase.from("conversations").insert({ is_group: false, created_by: userId }).select("*").single();
      if (convError) throw convError;
      const convId = (convData as any).id;
      await supabase.from("conversation_participants").insert([{ conversation_id: convId, user_id: userId }, { conversation_id: convId, user_id: otherUserId }]);
      await loadUserAndConversations();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to create conversation", description: e?.message });
    }
  };

  const createGroup = async () => {
    if (!userId) return;
    if (!(userRole === 'admin' || userRole === 'leader')) {
      toast({ variant: "destructive", title: "Permission denied", description: "Only leaders or admins can create groups" });
      return;
    }
    if (!newGroupName.trim() || selectedParticipants.length === 0) {
      toast({ variant: "destructive", title: "Validation", description: "Provide a name and at least one participant" });
      return;
    }
    try {
      const { data: convData, error: convError } = await supabase.from("conversations").insert({ is_group: true, subject: newGroupName.trim(), created_by: userId }).select("*").single();
      if (convError) throw convError;
      const convId = (convData as any).id;
      const parts = selectedParticipants.map((pid) => ({ conversation_id: convId, user_id: pid, role: pid === userId ? 'leader' : 'member' }));
      // ensure creator is participant
      if (!parts.find(p => p.user_id === userId)) parts.push({ conversation_id: convId, user_id: userId, role: 'leader' });
      await supabase.from("conversation_participants").insert(parts);
      setNewGroupName("");
      setSelectedParticipants([]);
      setCreatingGroup(false);
      await loadUserAndConversations();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to create group", description: e?.message });
    }
  };

  const toggleParticipantSelection = (id: string) => {
    setSelectedParticipants((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const addReaction = async (messageId: string, emoji: string) => {
    if (!userId) return;
    try {
      // toggle: if user already reacted with same emoji remove, else add
      const { data: existing } = await supabase.from<ReactionRow>("message_reactions").select("*").eq("message_id", messageId).eq("user_id", userId).eq("emoji", emoji).single();
      if (existing) {
        await supabase.from("message_reactions").delete().eq("id", existing.id);
      } else {
        await supabase.from("message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
      }
      // reload reactions for message
      const { data: reacts } = await supabase.from<ReactionRow>("message_reactions").select("*").eq("message_id", messageId);
      setReactions((prev) => ({ ...prev, [messageId]: (reacts || []).map((r) => ({ user_id: r.user_id, emoji: r.emoji })) }));
    } catch (e: unknown) {
      console.error('Failed to toggle reaction', e);
    }
  };

  const startEdit = (m: Message) => { setEditingMessageId(m.id); setEditingText(m.deleted ? "" : m.content); };
  const cancelEdit = () => { setEditingMessageId(null); setEditingText(""); };
  const saveEdit = async (messageId: string) => {
    try {
      await supabase.from("messages").update({ content: editingText, edited: true, edited_at: new Date().toISOString() }).eq("id", messageId);
      setEditingMessageId(null);
      setEditingText("");
      if (selected) await loadMessages(selected.id);
    } catch (e: unknown) {
      console.error('Failed to save edit', e);
      const msg = (e as any)?.message || String(e);
      toast({ variant: 'destructive', title: 'Edit failed', description: msg });
    }
  };

  const toggleDelete = async (messageId: string, markDeleted = true) => {
    try {
      if (markDeleted) {
        await supabase.from("messages").update({ deleted: true, deleted_at: new Date().toISOString() }).eq("id", messageId);
      } else {
        await supabase.from("messages").update({ deleted: false, deleted_at: null }).eq("id", messageId);
      }
      if (selected) await loadMessages(selected.id);
    } catch (e: unknown) {
      console.error('Failed to toggle delete', e);
      const msg = (e as any)?.message || String(e);
      toast({ variant: 'destructive', title: 'Operation failed', description: msg });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-20 md:pb-6">
        <div className="mb-2">
          <h2 className="text-4xl font-heading font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            {t('nav.messages')}
          </h2>
          <p className="text-muted-foreground mt-2">{t('messages.description') || 'Direct messages between users'}</p>
        </div>

        <div className="flex gap-6">
          <aside className="w-80 bg-card border rounded-md p-3 h-[70vh] overflow-auto">
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <Input placeholder="Search" className="flex-1" />
                <Button variant="ghost" size="icon" onClick={() => setCreatingGroup(!creatingGroup)} title="Create group">
                  <PlusCircle className="w-5 h-5" />
                </Button>
              </div>

              {!creatingGroup && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2">Start new direct message</p>
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {profiles.map((p) => (
                      <div key={p.id} className="flex items-center justify-between">
                        <button className="flex items-center gap-2 w-full text-left p-1 rounded hover:bg-muted" onClick={() => createDirectConversation(p.id)}>
                          <Avatar>
                            <AvatarFallback className="gradient-primary text-white">{(p.first_name || p.last_name || 'U')[0]}</AvatarFallback>
                          </Avatar>
                          <div className="text-sm">{p.first_name} {p.last_name}</div>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {creatingGroup && (
                <div className="mt-3 border rounded p-2">
                  <div className="mb-2">
                    <Input placeholder="Group name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                  </div>
                  <div className="max-h-40 overflow-auto mb-2">
                    {profiles.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 p-1 hover:bg-muted rounded">
                        <input type="checkbox" checked={selectedParticipants.includes(p.id)} onChange={() => toggleParticipantSelection(p.id)} />
                        <div className="text-sm">{p.first_name} {p.last_name}</div>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={createGroup}>Create Group</Button>
                    <Button variant="ghost" onClick={() => setCreatingGroup(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {conversations.length === 0 && <p className="text-sm text-muted-foreground">No conversations</p>}
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`w-full text-left p-2 rounded-md hover:bg-muted ${selected?.id === c.id ? 'bg-muted' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="gradient-primary text-white">{c.is_group ? 'G' : 'M'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">{c.subject || (c.is_group ? 'Group' : 'Conversation')}</div>
                      <div className="text-xs text-muted-foreground">{c.last_message_at ? new Date(c.last_message_at).toLocaleString() : ''}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex-1 bg-card border rounded-md p-4 h-[70vh] flex flex-col">
            <div className="border-b pb-3 mb-3">
              <h3 className="font-semibold">{selected?.subject || 'Conversation'}</h3>
            </div>

            <div ref={scrollerRef} className="flex-1 overflow-auto space-y-3 px-2">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-3 rounded-lg ${m.sender_id === userId ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                    {editingMessageId === m.id ? (
                      <div>
                        <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} />
                        <div className="flex gap-2 justify-end mt-2">
                          <Button size="sm" onClick={() => saveEdit(m.id)}><Check className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm whitespace-pre-wrap">{m.deleted ? <em className="text-muted-foreground">Message deleted</em> : m.content}</div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()} {m.edited ? '(edited)' : ''}</div>
                          <div className="flex items-center gap-2">
                            {/* reactions */}
                            <div className="flex items-center gap-1">
                              {Object.entries((reactions[m.id] || []).reduce((acc: Record<string, number>, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})).map(([emoji, count]) => (
                                <button key={emoji} className="text-xs px-1 rounded-md bg-muted" onClick={() => addReaction(m.id, emoji)}>{emoji} {count}</button>
                              ))}
                              <button className="text-xs px-1 rounded-md hover:bg-muted" onClick={() => addReaction(m.id, '👍')}><Smile className="w-4 h-4 inline" /></button>
                            </div>

                            {/* edit/delete controls */}
                            {(m.sender_id === userId || userRole === 'admin') && !m.deleted && (
                              <>
                                <Button size="icon" variant="ghost" onClick={() => startEdit(m)}><Edit3 className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => toggleDelete(m.id, true)}><Trash2 className="w-4 h-4" /></Button>
                              </>
                            )}
                            {m.deleted && (m.sender_id === userId || userRole === 'admin') && (
                              <Button size="icon" variant="ghost" onClick={() => toggleDelete(m.id, false)}>Restore</Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <div className="flex gap-2 items-center">
                <input type="file" accept="image/*,video/*" onChange={handleFileChange} />
                {pendingAttachment && (
                  <div className="flex items-center gap-2">
                    <div className="text-sm">Attached</div>
                    <a href={pendingAttachment.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground">Preview</a>
                  </div>
                )}
              </div>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message..." />
              <div className="flex justify-between mt-2">
                <div>
                  {selected && (
                    <button className="flex items-center gap-1 text-xs" onClick={() => toggleMuteConversation(selected.id, !selected.muted)}>
                      {selected.muted ? <><BellOff className="w-4 h-4" /> Mute off</> : <><Bell className="w-4 h-4" /> Mute</>}
                    </button>
                  )}
                </div>
                <div>
                  <Button onClick={handleSend} disabled={!(text.trim() || pendingAttachment)}>Send</Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
