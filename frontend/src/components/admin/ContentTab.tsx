"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Post {
  id: string;
  author_username: string;
  content: string;
  flag_count: number;
  is_hidden: boolean;
  created_at: string;
}

export default function ContentTab() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"flagged" | "recent" | "hidden">(
    "flagged"
  );
  const [page, setPage] = useState(1);

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadPosts();
  }, [filter, page]);

  async function loadPosts() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        skip: String((page - 1) * ITEMS_PER_PAGE),
      });

      if (filter === "flagged") {
        params.append("flagged_only", "true");
      } else if (filter === "hidden") {
        params.append("hidden_only", "true");
      }

      const res = await fetch(`/api/v1/admin/posts?${params}`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setPosts(Array.isArray(data) ? data : data.posts || []);
      }
    } catch (err) {
      console.error("Failed to load posts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updatePostStatus(postId: string, isHidden: boolean) {
    try {
      const res = await fetch(`/api/v1/admin/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_hidden: isHidden }),
      });

      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, is_hidden: isHidden } : p
          )
        );
      }
    } catch (err) {
      console.error("Failed to update post:", err);
    }
  }

  async function deletePost(postId: string) {
    if (!confirm("Delete this post permanently?")) return;

    try {
      const res = await fetch(`/api/v1/admin/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch (err) {
      console.error("Failed to delete post:", err);
    }
  }

  function truncate(text: string, limit: number = 100): string {
    return text.length > limit ? text.substring(0, limit) + "…" : text;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {(["flagged", "recent", "hidden"] as const).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              filter === f
                ? "bg-neon-purple text-white"
                : "bg-surface text-text-secondary hover:text-text-primary"
            }`}
          >
            {f === "flagged"
              ? "🚩 Flagged"
              : f === "recent"
                ? "Recent"
                : "Hidden"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-center py-8 text-text-muted animate-pulse">
            Loading…
          </p>
        ) : posts.length === 0 ? (
          <p className="text-center py-8 text-text-muted">No posts found</p>
        ) : (
          posts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4 rounded-lg border border-border"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-text-primary">
                      @{post.author_username}
                    </span>
                    {post.is_hidden && (
                      <span className="text-xs bg-gray-500/20 text-gray-300 px-2 py-0.5 rounded">
                        Hidden
                      </span>
                    )}
                    {post.flag_count > 0 && (
                      <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                        🚩 {post.flag_count}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary">
                    {truncate(post.content, 200)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                {post.is_hidden ? (
                  <button
                    onClick={() => updatePostStatus(post.id, false)}
                    className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-all"
                  >
                    Unhide
                  </button>
                ) : (
                  <button
                    onClick={() => updatePostStatus(post.id, true)}
                    className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-all"
                  >
                    Hide
                  </button>
                )}

                <button
                  onClick={() => deletePost(post.id)}
                  className="px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {posts.length > 0 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-xs disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-text-muted">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={posts.length < ITEMS_PER_PAGE}
            className="btn-secondary text-xs disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
