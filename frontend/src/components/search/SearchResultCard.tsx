"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
interface SearchResultCardProps {
  type: "user" | "post" | "room";
  data: Record<string, unknown>;
  onFollow?: (username: string) => void;
  onJoin?: (roomId: string) => void;
}

export default function SearchResultCard({
  type,
  data,
  onFollow,
  onJoin,
}: SearchResultCardProps) {
  const router = useRouter();

  if (type === "user") {
    const u = data as Record<string, string | number | null | undefined>;
    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        onClick={() => router.push(`/profile/${u.username}`)}
        className="w-full glass-card p-4 text-left hover:shadow-card-hover transition-all"
      >
        <div className="flex items-start gap-4">
          {u.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={u.avatar_url as string}
              alt={u.username as string}
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-clout/20 flex items-center justify-center flex-shrink-0 text-sm font-bold text-clout">
              {((u.username as string)?.[0] ?? "?").toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-primary">{u.display_name}</h3>
            <p className="text-sm text-text-muted mb-2">@{u.username}</p>
            {u.bio && (
              <p className="text-sm text-text-secondary line-clamp-2">{u.bio}</p>
            )}
            <div className="flex gap-3 mt-2 text-xs text-text-muted">
              <span>👥 {Number(u.follower_count ?? 0).toLocaleString()} followers</span>
              <span>◈ {Number(u.market_cap ?? 0).toLocaleString()} cap</span>
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onFollow?.(u.username as string); }}
            className="px-3 py-1 rounded bg-accent text-background text-sm font-medium hover:bg-accent-hover transition-colors flex-shrink-0"
          >
            Follow
          </button>
        </div>
      </motion.button>
    );
  }

  if (type === "post") {
    const p = data as Record<string, string | number | null | undefined>;
    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        onClick={() => router.push(`/feed/${p.id}`)}
        className="w-full glass-card p-4 text-left hover:shadow-card-hover transition-all"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-accent">
            {((p.author_username as string)?.[0] ?? "?").toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-muted">@{p.author_username}</p>
            <p className="text-sm text-text-primary line-clamp-2 mt-1">{p.content}</p>
            <div className="flex gap-3 mt-2 text-xs text-text-muted">
              <span>♡ {p.like_count ?? 0} likes</span>
              <span>💬 {p.comment_count ?? 0} comments</span>
            </div>
          </div>
        </div>
      </motion.button>
    );
  }

  if (type === "room") {
    const r = data as Record<string, string | number | null | undefined>;
    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        className="w-full glass-card p-4 text-left hover:shadow-card-hover transition-all"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-text-primary">{r.name}</h3>
            <p className="text-sm text-text-secondary mt-1 line-clamp-2">{r.description}</p>
            <div className="flex gap-3 mt-2 text-xs text-text-muted">
              <span>👥 {Number(r.member_count ?? 0).toLocaleString()} members</span>
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onJoin?.(r.id as string); }}
            className="px-3 py-1 rounded bg-clout text-background text-sm font-medium hover:bg-clout-hover transition-colors flex-shrink-0"
          >
            Join
          </button>
        </div>
      </motion.button>
    );
  }

  return null;
}
