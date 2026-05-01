"use client";

import { useEffect, useRef, useState } from "react";

interface Comment {
  id: string;
  content: string;
  author: string;
  display_name: string | null;
  is_alter_ego: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

export default function PostComments({
  postId,
  alterEgoActive,
  alterEgoAlias,
  onCommentAdded,
}: {
  postId: string;
  alterEgoActive: boolean;
  alterEgoAlias: string | null;
  onCommentAdded?: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [useAlterEgo, setUseAlterEgo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/v1/feed/${postId}/comments?limit=50`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setComments(d); })
      .finally(() => setLoading(false));
  }, [postId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/feed/${postId}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), use_alter_ego: useAlterEgo }),
      });
      if (res.ok) {
        const c = await res.json();
        setComments((prev) => [...prev, c]);
        setContent("");
        onCommentAdded?.();
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const colors = ["#9d4edd", "#f472b6", "#60a5fa", "#00e5a0", "#fbbf24"];

  return (
    <div className="px-1 pt-1 pb-3 border-t border-[#1a1a1a] mt-1">
      {loading ? (
        <p className="text-xs text-[#444] py-3 pl-1 animate-pulse">Loading comments…</p>
      ) : (
        <div className="flex flex-col gap-3 max-h-56 overflow-y-auto pr-1 pt-3">
          {comments.length === 0 && (
            <p className="text-xs text-[#444] pl-1">No comments yet — be the first.</p>
          )}
          {comments.map((c) => {
            const bg = colors[c.author.charCodeAt(0) % colors.length];
            return (
              <div key={c.id} className="flex gap-2.5 items-start">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${bg}, ${bg}99)` }}
                >
                  {c.is_alter_ego ? "?" : (c.author?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 bg-[#161616] rounded-2xl rounded-tl-sm px-3 py-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-semibold ${c.is_alter_ego ? "text-violet-400" : "text-[#ccc]"}`}>
                      @{c.author}
                    </span>
                    {c.is_alter_ego && (
                      <span className="text-[9px] px-1 py-0.5 rounded-full bg-violet-900/40 text-violet-500">anon</span>
                    )}
                    <span className="text-[10px] text-[#444] ml-auto">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-xs text-[#c0c0c0] leading-relaxed">{c.content}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Comment input */}
      <form onSubmit={submit} className="flex items-center gap-2 mt-3">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 500))}
          placeholder="Add a comment…"
          className="flex-1 bg-[#161616] border border-[#262626] rounded-full px-4 py-2 text-xs
                     text-[#ddd] placeholder-[#444] focus:outline-none focus:border-[#0095f650] transition-colors"
        />
        {alterEgoActive && alterEgoAlias && (
          <label className="flex items-center gap-1 cursor-pointer select-none flex-shrink-0">
            <input type="checkbox" checked={useAlterEgo} onChange={(e) => setUseAlterEgo(e.target.checked)} className="accent-violet-500 w-3 h-3" />
            <span className="text-[10px] text-violet-400">anon</span>
          </label>
        )}
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="btn-ig-sm flex-shrink-0 disabled:opacity-40"
        >
          Post
        </button>
      </form>
    </div>
  );
}
