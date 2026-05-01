"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProfileStatsProps {
  postCount: number;
  followerCount: number;
  followingCount: number;
  marketCap: number;
}

interface StatItem {
  label: string;
  value: number | string;
  tooltip: string;
  icon?: string;
}

export default function ProfileStats({
  postCount,
  followerCount,
  followingCount,
  marketCap,
}: ProfileStatsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const stats: StatItem[] = [
    {
      label: "Posts",
      value: postCount,
      tooltip: "Total posts created",
      icon: "📝",
    },
    {
      label: "Followers",
      value: followerCount.toLocaleString(),
      tooltip: "Users following this profile",
      icon: "👥",
    },
    {
      label: "Following",
      value: followingCount.toLocaleString(),
      tooltip: "Profiles this user follows",
      icon: "🔗",
    },
    {
      label: "Market Cap",
      value: `◈ ${marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      tooltip: "Investment value and reputation score",
      icon: "💰",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
      {stats.map((stat, idx) => (
        <motion.div
          key={stat.label}
          onHoverStart={() => setHoveredIndex(idx)}
          onHoverEnd={() => setHoveredIndex(null)}
          whileHover={{ scale: 1.05 }}
          className={cn(
            "relative p-4 rounded-lg border transition-all cursor-help",
            hoveredIndex === idx
              ? "bg-surface-raised border-clout shadow-card-hover"
              : "bg-surface border-border hover:border-clout/30"
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-text-muted mb-1">{stat.label}</p>
              <p className="text-xl font-semibold text-text-primary">
                {stat.value}
              </p>
            </div>
            {stat.icon && (
              <span className="text-lg opacity-50">{stat.icon}</span>
            )}
          </div>

          {/* Tooltip */}
          {hoveredIndex === idx && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-surface-raised border border-border rounded text-xs text-text-secondary whitespace-nowrap z-50"
            >
              {stat.tooltip}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-surface-raised" />
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
