"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface Room {
  id: string;
  name: string;
  description: string | null;
  creator_username: string;
  creator_avatar_url: string | null;
  member_count: number;
  is_public: boolean;
  is_password_protected: boolean;
  created_at: string;
}

interface RoomCardProps {
  room: Room;
  isMember: boolean;
  onlineCount?: number;
  onJoinClick?: (room: Room) => void;
}

export default function RoomCard({
  room,
  isMember,
  onlineCount = 0,
  onJoinClick,
}: RoomCardProps) {
  const router = useRouter();
  const [hovering, setHovering] = useState(false);

  const handleCardClick = () => {
    if (isMember) {
      router.push(`/rooms/${room.id}`);
    }
  };

  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onJoinClick) {
      onJoinClick(room);
    }
  };

  const descriptionText = room.description
    ? room.description.length > 80
      ? room.description.substring(0, 80) + "..."
      : room.description
    : "No description";

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={handleCardClick}
      className={cn(
        "glass-card p-4 rounded-lg cursor-pointer transition-all duration-200",
        hovering ? "shadow-lg border-neon-purple/50" : "border-border"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary truncate hover:text-neon-purple transition-colors">
            {room.name}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {room.is_public ? (
            <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
              Public
            </span>
          ) : (
            <span className="text-xs bg-neon-purple/20 text-neon-purple px-2 py-0.5 rounded-full">
              🔒 Private
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-text-muted line-clamp-2 mb-3">{descriptionText}</p>

      {/* Creator & Stats */}
      <div className="flex items-center justify-between mb-3 py-2 border-t border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          {room.creator_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={room.creator_avatar_url}
              alt={room.creator_username}
              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-neon-purple/30 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
              {(room.creator_username?.[0] ?? "?").toUpperCase()}
            </div>
          )}
          <span className="text-xs text-text-secondary truncate">
            {room.creator_username}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-text-muted flex-shrink-0">
          <span>👥</span>
          <span>{room.member_count}</span>
          {onlineCount > 0 && (
            <>
              <span className="text-neon-green">●</span>
              <span className="text-neon-green">{onlineCount}</span>
            </>
          )}
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleJoinClick}
        className={cn(
          "w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200",
          isMember
            ? "bg-neon-green/20 text-neon-green hover:bg-neon-green/30"
            : room.is_password_protected
              ? "btn-primary"
              : "btn-secondary"
        )}
      >
        {isMember ? "✓ You're a member" : room.is_password_protected ? "🔒 Join" : "Join"}
      </button>
    </motion.div>
  );
}
