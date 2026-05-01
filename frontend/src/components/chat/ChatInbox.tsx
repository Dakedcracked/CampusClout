"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChatThread from "./ChatThread";

interface ThreadParticipant {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url?: string | null;
  market_cap: number;
}

interface Thread {
  id: string;
  other_user: ThreadParticipant;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function UserAvatar({ username, avatar, size = 48 }: { username: string; avatar?: string | null; size?: number }) {
  if (avatar) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatar} alt={username} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  );
  const colors = ["#9d4edd", "#f472b6", "#60a5fa", "#00e5a0", "#fbbf24"];
  const bg = colors[username.charCodeAt(0) % colors.length];
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${bg}, ${bg}cc)`, fontSize: size * 0.38 }}>
      {(username[0] ?? "?").toUpperCase()}
    </div>
  );
}

export default function ChatInbox({ myUserId, myMarketCap }: { myUserId: string; myMarketCap: number }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dmCostPreview, setDmCostPreview] = useState<{ cost: number; cap: number } | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadThreads() {
    const res = await fetch("/api/v1/chat/threads", { credentials: "include" });
    if (res.ok) setThreads(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadThreads(); }, []);

  async function fetchCostPreview(username: string) {
    if (!username.trim()) { setDmCostPreview(null); return; }
    const res = await fetch(`/api/v1/chat/cost/${username.trim()}`, { credentials: "include" });
    if (res.ok) {
      const d = await res.json();
      setDmCostPreview({ cost: d.token_cost, cap: d.target_market_cap });
    }
  }

  async function startChat(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/v1/chat/threads/${search.trim().toLowerCase()}`, { method: "POST", credentials: "include" });
      const d = await res.json();
      if (!res.ok) { setSearchError(d.detail ?? "User not found"); return; }
      setActiveThread(d as Thread);
      await loadThreads();
      setSearch("");
      setDmCostPreview(null);
    } finally {
      setSearching(false);
    }
  }

  if (activeThread) {
    return (
      <ChatThread
        threadId={activeThread.id}
        myUserId={myUserId}
        otherUsername={activeThread.other_user.username}
        otherMarketCap={activeThread.other_user.market_cap}
        myMarketCap={myMarketCap}
        onBack={() => { setActiveThread(null); loadThreads(); }}
      />
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black gradient-text">Messages</h2>
          <p className="text-text-muted text-xs">{threads.length} conversation{threads.length !== 1 ? "s" : ""}</p>
        </div>
        <span className="text-2xl">💬</span>
      </div>

      {/* New DM */}
      <form onSubmit={startChat} className="mb-4">
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); fetchCostPreview(e.target.value); }}
            placeholder="Find someone by username…"
            className="input-field flex-1 text-sm"
          />
          <button type="submit" disabled={searching || !search.trim()} className="btn-primary text-sm px-4 py-2.5 whitespace-nowrap">
            {searching ? "…" : "Chat"}
          </button>
        </div>
        {dmCostPreview !== null && search && (
          <p className="text-xs font-mono px-1 mt-1.5">
            {dmCostPreview.cost === 0
              ? <span className="text-accent">✓ Free to message</span>
              : <span className="text-neon-pink">💎 {dmCostPreview.cost}◈ per message (their cap: {dmCostPreview.cap.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>}
          </p>
        )}
        {searchError && <p className="text-xs text-danger px-1 mt-1">{searchError}</p>}
      </form>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl shimmer-bg" />)}
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center py-16">
            <div className="text-5xl animate-float">💌</div>
            <div>
              <p className="font-semibold text-text-secondary">No messages yet</p>
              <p className="text-text-muted text-sm mt-1">Search for a username above to start a conversation</p>
            </div>
          </div>
        ) : (
          <AnimatePresence>
            {threads.map((t) => (
              <motion.button
                key={t.id} layout
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => setActiveThread(t)}
                className="w-full text-left rounded-2xl p-4 flex items-center gap-3 transition-all duration-200 hover:scale-[1.01]"
                style={{ background: "linear-gradient(135deg, #0f1020, #0a0b14)", border: "1px solid #1a1d35" }}
                whileHover={{ borderColor: "#9d4edd40" }}
              >
                <div className="relative">
                  <UserAvatar username={t.other_user.username} avatar={t.other_user.avatar_url} size={48} />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-accent border-2 border-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-text-primary">
                      {t.other_user.display_name ?? `@${t.other_user.username}`}
                    </p>
                    <span className="text-xs text-text-muted">{timeAgo(t.last_message_at)}</span>
                  </div>
                  <p className="text-xs text-text-muted truncate mt-0.5">
                    {t.last_message_preview ?? "Start the conversation ✨"}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-xs text-clout">{t.other_user.market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className="text-[10px] text-text-muted">cap</div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
