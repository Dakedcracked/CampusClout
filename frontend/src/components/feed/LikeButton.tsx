"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";

interface LikeButtonProps {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  onLikeChange?: (liked: boolean, count: number) => void;
}

export default function LikeButton({
  postId,
  initialLiked,
  initialCount,
  onLikeChange,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function toggleLike() {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/v1/posts/${postId}/like`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        const newLiked = !liked;
        const newCount = newLiked ? count + 1 : Math.max(0, count - 1);
        
        setLiked(newLiked);
        setCount(newCount);
        onLikeChange?.(newLiked, newCount);
      }
    } catch (err) {
      console.error("Failed to toggle like:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggleLike}
      disabled={loading}
      className="flex items-center gap-2 text-sm transition-colors"
      title={liked ? "Unlike" : "Like"}
    >
      <Heart
        size={18}
        className={`transition-all ${
          liked
            ? "fill-red-500 text-red-500"
            : "text-gray-400 hover:text-red-500"
        }`}
      />
      <span
        className={`${
          liked ? "text-red-500 font-semibold" : "text-gray-400"
        }`}
      >
        {count > 0 ? count : ""}
      </span>
    </button>
  );
}
