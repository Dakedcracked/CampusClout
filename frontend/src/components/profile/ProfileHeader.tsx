"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface User {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  university_domain?: string;
}

interface Balance {
  market_cap: number;
  tokens_invested_in_me: number;
}

interface ProfileHeaderProps {
  user: User;
  balance: Balance;
  postCount: number;
  followerCount: number;
  followingCount: number;
  ratingScore: number;
  ratingCount: number;
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
  postCount,
  followerCount,
  followingCount,
  ratingScore,
  ratingCount,
  isOwner,
  isFollowing = false,
  onEdit,
  onFollow,
  onMessage,
  onRate,
}: ProfileHeaderProps) {
  const bgColor = avatarColors[user.username.charCodeAt(0) % avatarColors.length];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10 mb-10 px-4 mt-6"
    >
      {/* Avatar - Left side */}
      <div className="md:flex-[1] flex justify-center md:justify-end md:pr-4">
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="w-[150px] h-[150px] rounded-full border border-border overflow-hidden bg-surface flex-shrink-0"
        >
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-5xl font-black text-white"
              style={{ background: `linear-gradient(135deg, ${bgColor}, ${bgColor}99)` }}
            >
              {((user.display_name ?? user.username)?.[0] ?? "?").toUpperCase()}
            </div>
          )}
        </motion.div>
      </div>

      {/* Info - Right side */}
      <div className="md:flex-[2] flex flex-col gap-4 w-full">
        {/* Row 1: Username & Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center md:items-start gap-4">
          <h1 className="text-xl md:text-xl font-normal text-text-primary mr-2">
            {user.username}
          </h1>
          <div className="flex flex-wrap justify-center gap-2">
            {isOwner ? (
              <button
                onClick={onEdit}
                className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg bg-[#363636] text-white text-xs sm:text-sm font-semibold hover:bg-[#262626] transition-colors"
              >
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={onFollow}
                  className={cn(
                    "px-4 sm:px-6 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors",
                    isFollowing
                      ? "bg-[#363636] text-white hover:bg-[#262626]"
                      : "bg-[#0095f6] text-white hover:bg-[#1877f2]"
                  )}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
                <button
                  onClick={onMessage}
                  className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg bg-[#363636] text-white text-xs sm:text-sm font-semibold hover:bg-[#262626] transition-colors"
                >
                  Message
                </button>
                <button
                  onClick={onRate}
                  className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg bg-[#363636] text-white text-xs sm:text-sm font-semibold hover:bg-[#262626] transition-colors flex items-center gap-1"
                >
                  Rate <span className="text-warning text-xs ml-1">⭐ {ratingScore > 0 ? ratingScore.toFixed(1) : "New"}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Stats */}
        <div className="flex flex-wrap justify-center md:justify-start gap-4 sm:gap-6 md:gap-8 text-sm sm:text-base">
          <div className="min-w-[90px] text-center"><span className="font-semibold text-text-primary">{postCount.toLocaleString()}</span> <span className="text-text-primary">posts</span></div>
          <div className="min-w-[90px] text-center cursor-pointer hover:opacity-80"><span className="font-semibold text-text-primary">{followerCount.toLocaleString()}</span> <span className="text-text-primary">followers</span></div>
          <div className="min-w-[90px] text-center cursor-pointer hover:opacity-80"><span className="font-semibold text-text-primary">{followingCount.toLocaleString()}</span> <span className="text-text-primary">following</span></div>
          <div className="min-w-[90px] text-center" title="Market Cap"><span className="font-semibold text-[#a78bfa]">◈ {(balance.market_cap >= 1000 ? (balance.market_cap / 1000).toFixed(1) + 'k' : balance.market_cap.toFixed(0))}</span> <span className="text-text-primary">cap</span></div>
        </div>

        {/* Row 3: Bio */}
        <div className="text-sm mt-1 text-center md:text-left">
          <span className="font-bold text-text-primary block mb-0.5">{user.display_name}</span>
          <span className="text-text-primary whitespace-pre-wrap">{user.bio}</span>
          {user.university_domain && (
            <div className="text-blue-400 mt-1 cursor-pointer hover:underline">@{user.university_domain}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
