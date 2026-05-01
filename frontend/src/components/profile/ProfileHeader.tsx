"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface User {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface Balance {
  market_cap: number;
  tokens_invested_in_me: number;
}

interface ProfileHeaderProps {
  user: User;
  balance: Balance;
  followerCount: number;
  ratingScore: number;
  ratingCount: number;
  coverImage: string | null;
  isOwner: boolean;
  isFollowing?: boolean;
  onEdit?: () => void;
  onFollow?: () => void;
  onMessage?: () => void;
  onRate?: () => void;
}

const avatarColors = ["#9d4edd", "#f472b6", "#60a5fa", "#00e5a0", "#fbbf24"];

export default function ProfileHeader({
  user,
  balance,
  followerCount,
  ratingScore,
  ratingCount,
  coverImage,
  isOwner,
  isFollowing = false,
  onEdit,
  onFollow,
  onMessage,
  onRate,
}: ProfileHeaderProps) {
  const bgColor =
    avatarColors[user.username.charCodeAt(0) % avatarColors.length];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-6"
    >
      {/* Cover Image */}
      <div className="relative w-full h-48 bg-gradient-card rounded-xl overflow-hidden border border-border mb-12">
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${bgColor}40, ${bgColor}20)`,
            }}
          />
        )}
      </div>

      {/* Profile Info */}
      <div className="px-4 relative">
        {/* Avatar */}
        <div className="flex items-end gap-4 mb-4 -mt-16 relative z-10">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="w-32 h-32 rounded-full border-4 border-background overflow-hidden bg-surface flex-shrink-0"
          >
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt={user.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-4xl font-black text-white"
                style={{
                  background: `linear-gradient(135deg, ${bgColor}, ${bgColor}99)`,
                }}
              >
                {((user.display_name ?? user.username)?.[0] ?? "?").toUpperCase()}
              </div>
            )}
          </motion.div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-2">
            {isOwner ? (
              <button
                onClick={onEdit}
                className="px-4 py-2 rounded-lg bg-clout text-background text-sm font-medium hover:bg-clout-hover transition-colors"
              >
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={onFollow}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isFollowing
                      ? "bg-border text-text-secondary hover:bg-border/80"
                      : "bg-accent text-background hover:bg-accent-hover"
                  )}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
                <button
                  onClick={onMessage}
                  className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm font-medium hover:bg-surface transition-colors"
                >
                  Message
                </button>
                <button
                  onClick={onRate}
                  className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm font-medium hover:bg-surface transition-colors"
                >
                  Rate
                </button>
              </>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="space-y-1 mb-4">
          <h1 className="text-3xl font-bold text-text-primary">
            {user.display_name ?? `@${user.username}`}
          </h1>
          <p className="text-text-secondary">@{user.username}</p>
          {user.bio && (
            <p className="text-text-primary pt-2 max-w-2xl">{user.bio}</p>
          )}
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-clout font-mono font-semibold">
              {followerCount.toLocaleString()}
            </span>
            <span className="text-text-muted">followers</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="font-mono font-semibold text-accent">
              ◈ {balance.market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-text-muted">cap</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-warning">⭐ {ratingScore.toFixed(1)}</span>
            <span className="text-text-muted">({ratingCount} ratings)</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
