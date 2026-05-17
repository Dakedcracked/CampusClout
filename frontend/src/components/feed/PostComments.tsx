"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { safeJsonParse } from "@/lib/safe-json";

interface Comment {
  id: string;
  content: string;
  author: string;
  display_name: string | null;
  avatar_url: string | null;
  is_alter_ego: boolean;
  like_count: number;
  reply_count: number;
  parent_id: string | null;
  created_at: string;
}

const COLORS = ["#9d4edd","#f472b6","#60a5fa","#00e5a0","#fbbf24","#f97316"];
const bgColor = (n: string) => COLORS[n.charCodeAt(0) % COLORS.length];

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function CommentAvatar({ author, avatarUrl, isAlterEgo, size = 28 }: { author: string; avatarUrl?: string | null; isAlterEgo: boolean; size?: number }) {
  if (isAlterEgo) return (
    <div className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 bg-gradient-to-br from-violet-600 to-purple-900"
      style={{ width: size, height: size, fontSize: size * 0.38 }}>?</div>
  );
  if (avatarUrl) return <img src={avatarUrl} alt={author} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />;
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg,${bgColor(author)},${bgColor(author)}99)`, fontSize: size * 0.38 }}>
      {author[0].toUpperCase()}
    </div>
  );
}

function CommentItem({
  comment, postId, alterEgoActive, alterEgoAlias, depth = 0, onReplyAdded
}: {
  comment: Comment; postId: string; alterEgoActive: boolean; alterEgoAlias: string | null; depth?: number; onReplyAdded?: () => void;
}) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(comment.like_count);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  async function loadReplies() {
    if (loadingReplies) return;
    setLoadingReplies(true);
    const r = await fetch(`/api/v1/feed/${postId}/comments?parent_id=${comment.id}&limit=20`, { credentials: "include" });
    if (r.ok) setReplies(await r.json());
    setLoadingReplies(false);
    setShowReplies(true);
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/feed/${postId}/comments`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText.trim(), parent_id: comment.id, use_alter_ego: false }),
      });
      const c = await safeJsonParse(res);
      if (res.ok && c) {
        setReplies(prev => [...prev, c]);
        setShowReplies(true);
        setReplyText("");
        setReplying(false);
        onReplyAdded?.();
      }
    } finally { setSubmitting(false); }
  }

  return (
    <div style={{ marginLeft: depth > 0 ? "32px" : 0 }}>
      <div className="flex gap-2.5 items-start group">
        {comment.is_alter_ego ? (
          <CommentAvatar author={comment.author} isAlterEgo avatarUrl={null} size={28} />
        ) : (
          <Link href={`/profile/${comment.author}`}>
            <CommentAvatar author={comment.author} avatarUrl={comment.avatar_url} isAlterEgo={false} size={28} />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <div className="bg-[#161616] rounded-2xl rounded-tl-sm px-3 py-2">
            <div className="flex items-center gap-2 mb-0.5">
              {comment.is_alter_ego ? (
                <span className="text-xs font-semibold text-violet-400">@{comment.author}</span>
              ) : (
                <Link href={`/profile/${comment.author}`} className="text-xs font-semibold text-[#ccc] hover:underline">{comment.display_name ?? `@${comment.author}`}</Link>
              )}
              {comment.is_alter_ego && <span className="text-[9px] px-1 py-0.5 rounded-full bg-violet-900/40 text-violet-500">anon</span>}
              <span className="text-[10px] text-[#444] ml-auto">{timeAgo(comment.created_at)}</span>
            </div>
            <p className="text-xs text-[#c0c0c0] leading-relaxed">{comment.content}</p>
          </div>
          {/* Action row */}
          <div className="flex items-center gap-4 mt-1 ml-1">
            <button onClick={() => { setLiked(l => !l); setLikes(n => liked ? n - 1 : n + 1); }}
              className={`text-[11px] font-semibold transition-colors ${liked ? "text-pink-400" : "text-[#555] hover:text-[#888]"}`}>
              {liked ? "❤️" : "🤍"} {likes > 0 ? likes : ""}
            </button>
            {depth < 1 && (
              <button onClick={() => setReplying(r => !r)} className="text-[11px] text-[#555] hover:text-[#888] font-semibold transition-colors">
                Reply
              </button>
            )}
            {depth < 1 && comment.reply_count > 0 && (
              <button onClick={() => showReplies ? setShowReplies(false) : loadReplies()}
                className="text-[11px] text-[#555] hover:text-[#888] font-semibold transition-colors">
                {showReplies ? "Hide" : `${comment.reply_count} ${comment.reply_count === 1 ? "reply" : "replies"}`}
              </button>
            )}
          </div>
          {/* Reply input */}
          <AnimatePresence>
            {replying && (
              <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                onSubmit={submitReply} className="flex gap-2 mt-2 overflow-hidden">
                <input value={replyText} onChange={e => setReplyText(e.target.value.slice(0, 300))}
                  placeholder={`Reply to @${comment.author}…`} autoFocus
                  className="flex-1 bg-[#161616] border border-[#262626] rounded-full px-3 py-1.5 text-xs text-[#ddd] placeholder-[#444] focus:outline-none focus:border-[#9d4edd]/50 transition-colors" />
                <button type="submit" disabled={submitting || !replyText.trim()}
                  className="px-3 py-1 bg-[#9d4edd] text-white rounded-full text-xs font-semibold disabled:opacity-40 hover:bg-[#a855f7] transition-colors">
                  {submitting ? "…" : "Send"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
          {/* Replies */}
          <AnimatePresence>
            {showReplies && replies.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 space-y-2">
                {replies.map(r => (
                  <CommentItem key={r.id} comment={r} postId={postId} alterEgoActive={alterEgoActive}
                    alterEgoAlias={alterEgoAlias} depth={1} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function PostComments({
  postId, alterEgoActive, alterEgoAlias, onCommentAdded,
}: {
  postId: string; alterEgoActive: boolean; alterEgoAlias: string | null; onCommentAdded?: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [useAlterEgo, setUseAlterEgo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/v1/feed/${postId}/comments?limit=50`, { credentials: "include" })
      .then(r => r.ok ? safeJsonParse(r) : null)
      .then(d => { if (Array.isArray(d)) setComments(d); })
      .finally(() => setLoading(false));
  }, [postId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/feed/${postId}/comments`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), use_alter_ego: useAlterEgo }),
      });
      const c = await safeJsonParse(res);
      if (res.ok && c) {
        setComments(prev => [...prev, c]);
        setContent("");
        onCommentAdded?.();
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } finally { setSubmitting(false); }
  }

  return (
    <div className="px-1 pt-1 pb-3 border-t border-[#1a1a1a] mt-1">
      {loading ? (
        <p className="text-xs text-[#444] py-3 pl-1 animate-pulse">Loading comments…</p>
      ) : (
        <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1 pt-3 scrollbar-none">
          {comments.length === 0 && (
            <p className="text-xs text-[#444] pl-1">No comments yet — be the first.</p>
          )}
          {comments.map(c => (
            <CommentItem key={c.id} comment={c} postId={postId}
              alterEgoActive={alterEgoActive} alterEgoAlias={alterEgoAlias} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Comment input */}
      <form onSubmit={submit} className="flex items-center gap-2 mt-3">
        <input
          value={content}
          onChange={e => setContent(e.target.value.slice(0, 1000))}
          placeholder="Add a comment…"
          className="flex-1 bg-[#161616] border border-[#262626] rounded-full px-4 py-2 text-xs text-[#ddd] placeholder-[#444] focus:outline-none focus:border-[#9d4edd]/50 transition-colors"
        />
        {alterEgoActive && alterEgoAlias && (
          <label className="flex items-center gap-1 cursor-pointer select-none flex-shrink-0">
            <input type="checkbox" checked={useAlterEgo} onChange={e => setUseAlterEgo(e.target.checked)} className="accent-violet-500 w-3 h-3" />
            <span className="text-[10px] text-violet-400">anon</span>
          </label>
        )}
        <button type="submit" disabled={submitting || !content.trim()}
          className="px-4 py-1.5 bg-[#9d4edd] text-white rounded-full text-xs font-semibold disabled:opacity-40 hover:bg-[#a855f7] transition-colors flex-shrink-0">
          {submitting ? "…" : "Post"}
        </button>
      </form>
    </div>
  );
}
