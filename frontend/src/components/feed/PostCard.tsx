"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PostComments from "./PostComments";

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
  alterEgoActive = false,
  alterEgoAlias = null,
}: {
  post: Post;
  onLike?: (id: string, liked: boolean, count: number) => void;
  alterEgoActive?: boolean;
  alterEgoAlias?: string | null;
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
  const [isAuthor, setIsAuthor] = useState(false);

  // Check if current user is author
  useEffect(() => {
    async function checkAuthor() {
      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (res.ok) {
          const user = await res.json();
          setIsAuthor(user.username === post.author_username);
        }
      } catch {}
    }
    checkAuthor();
  }, [post.author_username]);

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
      if (res.ok) {
        const d = await res.json();
        setLiked(d.liked);
        setLikeCount(d.new_like_count);
        if (d.liked) { setHeartAnim(true); setTimeout(() => setHeartAnim(false), 400); }
        onLike?.(post.id, d.liked, d.new_like_count);
      }
    } finally {
      setLoading(false);
    }
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
        // Post deleted - parent should handle removal from feed
        window.location.reload();
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
        <AuthorAvatar post={post} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-white leading-none">{displayName}</span>
            {post.is_alter_ego_post && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-900/40 text-violet-400 font-medium">anon</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[#555]">@{handle}</span>
            <span className="text-[#333]">·</span>
            <span className="text-xs text-[#555]">{timeAgo(post.created_at)}</span>
            <span className="text-[#333]">·</span>
            <span className="text-xs text-[#a78bfa] font-mono">
              {post.author_market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 })} cap
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
        <button
          onClick={handleLike}
          disabled={loading}
          className="flex items-center gap-1.5 group"
        >
          <span
            className={`text-xl transition-all duration-150 ${heartAnim ? "animate-heartbeat" : ""} ${liked ? "drop-shadow-[0_0_4px_rgba(255,48,64,0.6)]" : ""}`}
            style={{ color: liked ? "#ff3040" : "#555", filter: liked ? "none" : undefined }}
          >
            {liked ? "♥" : "♡"}
          </span>
          <span className={`text-xs font-medium ${liked ? "text-[#ff3040]" : "text-[#555] group-hover:text-[#888]"} transition-colors`}>
            {likeCount > 0 ? likeCount.toLocaleString() : ""}
          </span>
        </button>

        <button
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 group"
        >
          <span className="text-xl text-[#555] group-hover:text-[#888] transition-colors">💬</span>
          <span className="text-xs font-medium text-[#555] group-hover:text-[#888] transition-colors">
            {commentCount > 0 ? commentCount : ""}
          </span>
        </button>
      </div>

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
