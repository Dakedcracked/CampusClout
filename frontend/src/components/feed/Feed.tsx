"use client";

import { useEffect, useState } from "react";
import PostCard, { type Post } from "./PostCard";
import CreatePost from "./CreatePost";


export default function Feed({
  alterEgoActive,
  alterEgoAlias,
  userAvatar,
  username,
}: {
  alterEgoActive: boolean;
  alterEgoAlias: string | null;
  userAvatar?: string | null;
  username?: string;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadFeed() {
    try {
      const res = await fetch(`/api/v1/feed?limit=30&_t=${Date.now()}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPosts(data);
        }
      } else {
        console.error("Feed load error:", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("Feed fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeed();
    // Refresh feed periodically to catch new posts
    const interval = setInterval(loadFeed, 30000);
    return () => clearInterval(interval);
  }, []);

  function handleNewPost(post: Post) {
    setPosts((prev) => [post, ...prev]);
  }

  function handleLike(id: string, liked: boolean, count: number) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, is_liked_by_me: liked, like_count: count } : p
      )
    );
  }

  function handleDeletePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-1 pb-3">
        <h2 className="font-bold text-lg gradient-text-ig">Campus Feed</h2>
        <span className="text-[10px] text-text-muted uppercase tracking-widest">Ranked by clout × recency</span>
      </div>


      <CreatePost
        onCreated={handleNewPost}
        alterEgoActive={alterEgoActive}
        alterEgoAlias={alterEgoAlias}
        userAvatar={userAvatar}
        username={username}
      />

      {loading ? (
        <p className="text-sm text-text-muted text-center py-8 animate-pulse">Loading feed…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">
          No posts yet. Be the first to say something!
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-[#1a1a1a]">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onLike={handleLike}
              onDelete={handleDeletePost}
              alterEgoActive={alterEgoActive}
              alterEgoAlias={alterEgoAlias}
              currentUsername={username}
            />
          ))}
        </div>
      )}
    </div>
  );
}
