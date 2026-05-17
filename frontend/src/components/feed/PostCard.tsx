"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import PostComments from "./PostComments";
import { safeJsonParse, getErrorMessage } from "@/lib/safe-json";

export interface Post {
  id: string;
  author_username: string;
  author_display_name: string | null;
  author_market_cap: number;
  author_avatar_url?: string | null;
  content: string;
  like_count: number;
  comment_count: number;
  is_liked_by_me: boolean;
  rank_score: number;
  is_alter_ego_post: boolean;
  alter_ego_alias: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function AuthorAvatar({ post, size = 38 }: { post: Post; size?: number }) {
  const colors = ["#9d4edd", "#f472b6", "#60a5fa", "#00e5a0", "#fbbf24"];
  const bg = colors[post.author_username.charCodeAt(0) % colors.length];
  const initials = (post.author_username?.[0] ?? "?").toUpperCase();

  if (post.author_avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={post.author_avatar_url}
        alt={post.author_username}
        className="rounded-full object-cover flex-shrink-0 story-ring"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 story-ring"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${bg}, ${bg}cc)`, fontSize: size * 0.38 }}
    >
      {post.is_alter_ego_post ? "?" : initials}
    </div>
  );
}

export default function PostCard({
  post,
  onLike,
  onDelete,
  alterEgoActive = false,
  alterEgoAlias = null,
  currentUsername,
}: {
  post: Post;
  onLike?: (id: string, liked: boolean, count: number) => void;
  onDelete?: (id: string) => void;
  alterEgoActive?: boolean;
  alterEgoAlias?: string | null;
  currentUsername?: string;
}) {
  const [liked, setLiked] = useState(post.is_liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0);
  const [loading, setLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [likers, setLikers] = useState<{ username: string; display_name: string | null; avatar_url: string | null }[]>([]);

  // Determine if current user is the author — no extra API call needed
  const isAuthor = !post.is_alter_ego_post && !!currentUsername && currentUsername === post.author_username;

  const displayName = post.is_alter_ego_post
    ? `@${post.alter_ego_alias ?? "anon"}`
    : (post.author_display_name ?? `@${post.author_username}`);

  const handle = post.is_alter_ego_post
    ? post.alter_ego_alias ?? "anon"
    : post.author_username;

  async function handleLike() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/feed/${post.id}/like`, {
        method: "POST",
        credentials: "include",
      });
      const d = await safeJsonParse(res);
      if (res.ok && d) {
        setLiked(d.liked);
        setLikeCount(d.like_count ?? d.new_like_count ?? likeCount);
        if (d.liked) { setHeartAnim(true); setTimeout(() => setHeartAnim(false), 400); }
        onLike?.(post.id, d.liked, d.like_count ?? d.new_like_count ?? likeCount);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    // Record to backend (fire and forget)
    fetch(`/api/v1/feed/${post.id}/share`, { method: "POST", credentials: "include" }).catch(() => {});
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    } catch {
      // fallback: use native share if available
      if (navigator.share) {
        await navigator.share({ title: post.author_display_name ?? post.author_username, text: post.content.slice(0, 100), url: `${window.location.origin}/post/${post.id}` });
        return;
      }
    }
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  }

  async function loadLikers() {
    if (likers.length > 0) { setShowLikers(l => !l); return; }
    const r = await fetch(`/api/v1/feed/${post.id}/likes?limit=20`, { credentials: "include" });
    const d = await safeJsonParse(r);
    if (r.ok && Array.isArray(d)) setLikers(d);
    setShowLikers(true);
  }

  async function handleEdit() {
    if (!editContent.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/feed/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        post.content = editContent;
        setEditing(false);
        setShowMenu(false);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/feed/${post.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        onDelete?.(post.id);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-[#1a1a1a] pb-1"
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-1 pt-4 pb-3">
        {post.is_alter_ego_post ? (
          <AuthorAvatar post={post} />
        ) : (
          <Link href={`/profile/${handle}`} className="cursor-pointer hover:opacity-80 transition-opacity">
            <AuthorAvatar post={post} />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {post.is_alter_ego_post ? (
              <span className="font-semibold text-sm text-white leading-none">{displayName}</span>
            ) : (
              <Link href={`/profile/${handle}`} className="font-semibold text-sm text-white leading-none hover:underline cursor-pointer">
                {displayName}
              </Link>
            )}
            {post.is_alter_ego_post && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-900/40 text-violet-400 font-medium">anon</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {post.is_alter_ego_post ? (
              <span className="text-xs text-[#555]">@{handle}</span>
            ) : (
              <Link href={`/profile/${handle}`} className="text-xs text-[#555] hover:underline cursor-pointer">@{handle}</Link>
            )}
            <span className="text-[#333]">·</span>
            <span className="text-xs text-[#555]">{timeAgo(post.created_at)}</span>
            <span className="text-[#333]">·</span>
            <span className="text-xs text-[#a78bfa] font-mono">
              {(post.author_market_cap ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} cap
            </span>
          </div>
        </div>
        {/* Menu button - only show for author */}
        {isAuthor && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="text-[#555] hover:text-[#888] transition-colors p-1"
            >
              ⋯
            </button>
            {showMenu && (
              <div className="absolute right-0 top-6 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-lg z-10 min-w-[120px]">
                <button
                  onClick={() => setEditing(true)}
                  className="w-full text-left px-4 py-2 hover:bg-[#222] text-xs text-[#888] hover:text-white transition-colors"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full text-left px-4 py-2 hover:bg-[#222] text-xs text-red-600 hover:text-red-500 transition-colors border-t border-[#333]"
                >
                  🗑️ Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {editing ? (
        <div className="px-1 pb-3 flex flex-col gap-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#555]"
            rows={4}
            maxLength={500}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setEditing(false);
                setEditContent(post.content);
              }}
              className="px-3 py-1 rounded text-xs font-medium text-[#888] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={loading}
              className="px-3 py-1 bg-[#a78bfa] text-black rounded text-xs font-medium hover:bg-[#c9b8ff] transition-colors disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        post.content && (
          <p className="text-sm leading-relaxed text-[#e0e0e0] px-1 pb-3 whitespace-pre-wrap">{post.content}</p>
        )
      )}

      {/* Media */}
      {post.media_url && post.media_type === "image" && (
        <div className="rounded-xl overflow-hidden border border-[#1e1e1e] mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.media_url}
            alt="Post media"
            className="w-full max-h-[500px] object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
      {post.media_url && post.media_type === "video" && (
        <div className="rounded-xl overflow-hidden border border-[#1e1e1e] mb-3">
          <video
            src={post.media_url}
            controls
            className="w-full max-h-[500px] bg-black"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-5 px-1 py-2">
        {/* Like */}
        <button onClick={handleLike} disabled={loading} className="flex items-center gap-1.5 group relative">
          <span className={`text-xl transition-all duration-150 ${heartAnim ? "animate-bounce drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" : ""} ${liked ? "drop-shadow-[0_0_4px_rgba(250,204,21,0.6)]" : ""}`}
            style={{ color: liked ? "#facc15" : "#555", filter: liked ? "none" : undefined }}>◈</span>
          <span className={`text-xs font-bold uppercase tracking-wider ${liked ? "text-[#facc15]" : "text-[#555] group-hover:text-[#888]"} transition-colors`}>
            {likeCount > 0 ? likeCount.toLocaleString() : ""}
          </span>
          {heartAnim && (
            <motion.span initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -20 }}
              className="absolute text-green-400 font-bold text-xs -mt-6 ml-4">+1 ◈</motion.span>
          )}
        </button>

        {/* Comment */}
        <button onClick={() => setShowComments(v => !v)} className="flex items-center gap-1.5 group">
          <span className="text-xl text-[#555] group-hover:text-[#888] transition-colors">💬</span>
          <span className="text-xs font-medium text-[#555] group-hover:text-[#888] transition-colors">
            {commentCount > 0 ? commentCount : ""}
          </span>
        </button>

        {/* Share */}
        <div className="relative">
          <button onClick={handleShare} className="flex items-center gap-1.5 group">
            <span className="text-xl text-[#555] group-hover:text-[#888] transition-colors">↗</span>
            <span className="text-xs text-[#555] group-hover:text-[#888] transition-colors">Share</span>
          </button>
          <AnimatePresence>
            {shareToast && (
              <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: -4 }} exit={{ opacity: 0 }}
                className="absolute bottom-7 left-0 bg-[#222] border border-[#333] text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap">
                🔗 Link copied!
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Who liked — click like count */}
        {likeCount > 0 && (
          <button onClick={loadLikers} className="ml-auto text-[10px] text-[#444] hover:text-[#666] transition-colors">
            {likeCount.toLocaleString()} like{likeCount !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Likers mini-list */}
      <AnimatePresence>
        {showLikers && likers.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden px-1 pb-2">
            <div className="flex flex-wrap gap-2">
              {likers.map(u => (
                <Link key={u.username} href={`/profile/${u.username}`}
                  className="flex items-center gap-1 text-[11px] text-[#888] hover:text-white transition-colors">
                  <span>@{u.username}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <PostComments
              postId={post.id}
              alterEgoActive={alterEgoActive}
              alterEgoAlias={alterEgoAlias}
              onCommentAdded={() => setCommentCount((n) => n + 1)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
