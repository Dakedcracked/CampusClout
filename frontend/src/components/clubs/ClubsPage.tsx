"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_emoji: string;
  banner_url: string | null;
  member_count: number;
  is_public: boolean;
  role: string | null;
}

interface ClubMsg {
  id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  sender: string;
  sender_display: string | null;
  sender_avatar: string | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function MsgAvatar({ sender, avatar }: { sender: string; avatar?: string | null }) {
  if (avatar) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatar} alt={sender} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
  );
  const colors = ["#9d4edd", "#f472b6", "#60a5fa", "#00e5a0", "#fbbf24"];
  const bg = colors[(sender.charCodeAt(0) ?? 0) % colors.length];
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
      style={{ background: `linear-gradient(135deg, ${bg}, ${bg}cc)` }}>
      {(sender[0] ?? "?").toUpperCase()}
    </div>
  );
}

function ClubRoom({ club, myUsername, onBack }: { club: Club; myUsername: string; onBack: () => void }) {
  const [messages, setMessages] = useState<ClubMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isMember, setIsMember] = useState(!!club.role);
  const [joining, setJoining] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadMessages = async () => {
    const r = await fetch(`${API}/api/v1/clubs/${club.slug}/messages?limit=100`, { credentials: "include" });
    if (r.ok) setMessages(await r.json());
  };

  useEffect(() => { if (isMember) loadMessages(); }, [isMember, club.slug]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Poll for new messages every 3s
  useEffect(() => {
    if (!isMember) return;
    const id = setInterval(loadMessages, 3000);
    return () => clearInterval(id);
  }, [isMember, club.slug]);

  async function join() {
    setJoining(true);
    try {
      const r = await fetch(`${API}/api/v1/clubs/${club.slug}/join`, { method: "POST", credentials: "include" });
      if (r.ok) { setIsMember(true); loadMessages(); }
    } finally { setJoining(false); }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/api/v1/clubs/${club.slug}/messages`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() }),
      });
      if (r.ok) {
        const msg = await r.json();
        setMessages(prev => [...prev, msg]);
        setInput("");
      }
    } finally { setSending(false); }
  }

  async function uploadMedia(file: File) {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const ur = await fetch(`${API}/api/v1/upload/image`, { method: "POST", credentials: "include", body: fd });
      if (!ur.ok) return;
      const { url, media_type } = await ur.json();
      const fullUrl = `${API}${url}`;
      const r = await fetch(`${API}/api/v1/clubs/${club.slug}/messages`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "📎", media_url: fullUrl, media_type: media_type ?? "image" }),
      });
      if (r.ok) { const msg = await r.json(); setMessages(prev => [...prev, msg]); }
    } finally { setUploading(false); }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
        <button onClick={onBack} className="text-text-muted hover:text-text-primary transition-colors text-lg">←</button>
        <span className="text-2xl">{club.icon_emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-text-primary">{club.name}</h3>
          <p className="text-xs text-text-muted">{club.member_count} members</p>
        </div>
        {isMember && <span className="neon-badge text-xs">{club.role === "owner" ? "👑 Owner" : "✓ Member"}</span>}
      </div>

      {!isMember ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
          <span className="text-6xl animate-float">{club.icon_emoji}</span>
          <div>
            <h3 className="font-black text-xl text-text-primary">{club.name}</h3>
            {club.description && <p className="text-text-muted text-sm mt-2 max-w-sm">{club.description}</p>}
            <p className="text-text-muted text-xs mt-3">{club.member_count} members · {club.is_public ? "Public" : "Private"}</p>
          </div>
          <button onClick={join} disabled={joining} className="btn-primary px-8 py-3">
            {joining ? "Joining…" : "Join Club"}
          </button>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 pb-2">
            {messages.length === 0 && (
              <div className="text-center text-text-muted text-sm py-12">
                <p className="text-3xl mb-2">{club.icon_emoji}</p>
                <p>No messages yet. Say hello!</p>
              </div>
            )}
            {messages.map((msg, i) => {
              const isMe = msg.sender === myUsername;
              const showHeader = i === 0 || messages[i - 1]?.sender !== msg.sender;
              return (
                <div key={msg.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  {!isMe && showHeader && <MsgAvatar sender={msg.sender} avatar={msg.sender_avatar} />}
                  {!isMe && !showHeader && <div className="w-8 flex-shrink-0" />}
                  <div className={`flex flex-col gap-1 max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                    {showHeader && !isMe && (
                      <span className="text-xs text-text-muted px-1">
                        {msg.sender_display ?? `@${msg.sender}`} · {timeAgo(msg.created_at)}
                      </span>
                    )}
                    {msg.media_url && msg.media_type === "image" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={msg.media_url} alt="" className="rounded-2xl max-w-full max-h-48 object-cover" />
                    )}
                    {msg.media_url && msg.media_type === "video" && (
                      <video src={msg.media_url} controls className="rounded-2xl max-w-full max-h-48" />
                    )}
                    {msg.content !== "📎" && (
                      <div className={`rounded-2xl px-4 py-2.5 text-sm ${isMe
                        ? "text-white rounded-tr-md"
                        : "text-text-primary rounded-tl-md"
                      }`} style={isMe
                        ? { background: "linear-gradient(135deg, #9d4edd, #f472b6)" }
                        : { background: "#0f1020", border: "1px solid #1a1d35" }
                      }>
                        {msg.content}
                      </div>
                    )}
                    {isMe && (
                      <span className="text-[10px] text-text-muted px-1">{timeAgo(msg.created_at)}</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={send} className="flex gap-2 mt-2 pt-3 border-t border-border">
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f); }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="text-text-muted hover:text-neon-purple transition-colors text-lg px-1 flex-shrink-0">
              {uploading ? "⌛" : "📎"}
            </button>
            <input value={input} onChange={e => setInput(e.target.value.slice(0, 2000))}
              placeholder={`Message #${club.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="input-field flex-1 text-sm py-2.5" />
            <button type="submit" disabled={sending || !input.trim()}
              className="btn-primary text-sm px-4 py-2.5 flex-shrink-0">
              {sending ? "…" : "↑"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ClubsPage({ myUsername }: { myUsername: string }) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [activeClub, setActiveClub] = useState<Club | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [newClub, setNewClub] = useState({ name: "", description: "", icon_emoji: "🎓", is_public: true });
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<"browse" | "mine">("browse");

  const EMOJIS = ["🎓", "🎵", "⚽", "💻", "🎨", "📚", "🏋️", "🎮", "🍕", "🌿", "🧪", "🎭", "📸", "🚀", "💡", "🎸"];

  async function load() {
    const [br, mr] = await Promise.all([
      fetch(`${API}/api/v1/clubs?${search ? `search=${encodeURIComponent(search)}` : ""}`, { credentials: "include" }),
      fetch(`${API}/api/v1/clubs/mine`, { credentials: "include" }),
    ]);
    if (br.ok) setClubs(await br.json());
    if (mr.ok) setMyClubs(await mr.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [search]);

  async function createClub(e: React.FormEvent) {
    e.preventDefault();
    if (!newClub.name.trim()) return;
    setSubmitting(true); setCreateError(null);
    try {
      const r = await fetch(`${API}/api/v1/clubs`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClub),
      });
      const d = await r.json();
      if (r.ok) {
        setCreating(false);
        setNewClub({ name: "", description: "", icon_emoji: "🎓", is_public: true });
        await load();
        setActiveClub(d);
      } else {
        setCreateError(d.detail ?? "Failed to create club");
      }
    } finally { setSubmitting(false); }
  }

  if (activeClub) {
    return (
      <ClubRoom
        club={activeClub}
        myUsername={myUsername}
        onBack={() => { setActiveClub(null); load(); }}
      />
    );
  }

  const displayClubs = view === "mine" ? myClubs : clubs;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black gradient-text">Clubs</h2>
          <p className="text-text-muted text-sm">Discord-style campus group rooms</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary text-sm">
          + Create Club
        </button>
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {creating && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setCreating(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card-glow p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="font-black text-lg gradient-text mb-4">Create a Club</h3>
              <form onSubmit={createClub} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs text-text-muted mb-1.5 block">Club Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {EMOJIS.map(e => (
                      <button key={e} type="button" onClick={() => setNewClub(n => ({ ...n, icon_emoji: e }))}
                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${newClub.icon_emoji === e ? "ring-2 ring-neon-purple bg-neon-purple/20" : "bg-surface-raised hover:bg-border"}`}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1.5 block">Club Name *</label>
                  <input value={newClub.name} onChange={e => setNewClub(n => ({ ...n, name: e.target.value.slice(0, 80) }))}
                    placeholder="e.g. CS Society, Gym Rats, Book Club" className="input-field" required />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1.5 block">Description</label>
                  <textarea value={newClub.description} onChange={e => setNewClub(n => ({ ...n, description: e.target.value.slice(0, 500) }))}
                    placeholder="What's this club about?" rows={3} className="input-field resize-none text-sm" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newClub.is_public} onChange={e => setNewClub(n => ({ ...n, is_public: e.target.checked }))} className="accent-neon-purple" />
                  <span className="text-sm text-text-secondary">Public club (anyone can join)</span>
                </label>
                {createError && <p className="text-danger text-xs">{createError}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting || !newClub.name.trim()} className="btn-primary flex-1">
                    {submitting ? "Creating…" : `${newClub.icon_emoji} Create Club`}
                  </button>
                  <button type="button" onClick={() => setCreating(false)} className="btn-secondary flex-1">Cancel</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View toggle + search */}
      <div className="flex gap-3 items-center">
        <div className="flex gap-1 bg-surface rounded-xl p-1">
          <button onClick={() => setView("browse")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === "browse" ? "tab-active" : "text-text-muted hover:text-text-primary"}`}>
            Browse All
          </button>
          <button onClick={() => setView("mine")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === "mine" ? "tab-active" : "text-text-muted hover:text-text-primary"}`}>
            My Clubs {myClubs.length > 0 && `(${myClubs.length})`}
          </button>
        </div>
        {view === "browse" && (
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search clubs…" className="input-field flex-1 py-2 text-sm" />
        )}
      </div>

      {/* Clubs grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="h-32 rounded-2xl shimmer-bg" />)}
        </div>
      ) : displayClubs.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-4xl mb-3">🎓</p>
          <p className="font-semibold text-text-secondary">{view === "mine" ? "You haven't joined any clubs" : "No clubs found"}</p>
          <p className="text-text-muted text-sm mt-1">{view === "mine" ? "Browse clubs to find your community" : "Be the first to create one!"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayClubs.map((club, i) => (
            <motion.div key={club.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => setActiveClub(club)}
              className="glass-card p-5 cursor-pointer hover:scale-[1.02] transition-all duration-200 flex flex-col gap-3"
              style={{ "--hover-border": "#9d4edd40" } as React.CSSProperties}>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #9d4edd20, #f472b615)", border: "1px solid #9d4edd30" }}>
                  {club.icon_emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-text-primary truncate">{club.name}</h3>
                    {club.role && <span className="neon-badge text-[10px]">{club.role === "owner" ? "👑" : "✓"}</span>}
                  </div>
                  <p className="text-xs text-text-muted">{club.member_count} members</p>
                </div>
              </div>
              {club.description && (
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{club.description}</p>
              )}
              <div className="flex items-center justify-between mt-auto">
                <span className="text-[10px] text-text-muted">{club.is_public ? "🌐 Public" : "🔒 Private"}</span>
                <span className="text-xs text-neon-purple font-semibold">
                  {club.role ? "Open →" : "Join →"}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
