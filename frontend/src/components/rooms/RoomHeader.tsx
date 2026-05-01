"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RoomHeaderProps {
  roomId: string;
  roomName: string;
  roomDescription: string | null;
  memberCount: number;
  onlineCount: number;
  creatorUsername: string;
  isCreator: boolean;
  onShowMembers: () => void;
}

export default function RoomHeader({
  roomId,
  roomName,
  roomDescription,
  memberCount,
  onlineCount,
  creatorUsername,
  isCreator,
  onShowMembers,
}: RoomHeaderProps) {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleLeaveRoom() {
    if (!confirm("Leave this room?")) return;

    try {
      const res = await fetch(`/api/v1/rooms/${roomId}/leave`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        const toast = document.createElement("div");
        toast.className =
          "fixed top-4 right-4 bg-accent/20 text-accent px-4 py-2 rounded-lg text-sm border border-accent/50 z-50";
        toast.textContent = "✓ Left room";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);

        setTimeout(() => router.push("/rooms"), 500);
      }
    } catch (err) {
      console.error("Failed to leave room:", err);
    }
  }

  async function handleDeleteRoom() {
    if (!confirm("Delete this room? This action cannot be undone.")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/rooms/${roomId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        const toast = document.createElement("div");
        toast.className =
          "fixed top-4 right-4 bg-red-500/20 text-red-300 px-4 py-2 rounded-lg text-sm border border-red-500/50 z-50";
        toast.textContent = "Room deleted";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);

        setTimeout(() => router.push("/rooms"), 500);
      }
    } catch (err) {
      console.error("Failed to delete room:", err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="glass-card rounded-lg p-6 mb-6 border border-border">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            {roomName}
          </h1>
          {roomDescription && (
            <p className="text-text-secondary text-sm">{roomDescription}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isCreator && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-surface hover:bg-surface-raised border border-border transition-all"
            >
              ⚙️ Settings
            </button>
          )}
          <button
            onClick={handleLeaveRoom}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/50 transition-all"
          >
            {isCreator ? "Delete" : "Leave"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 py-4 border-t border-b border-border/50">
        <button
          onClick={onShowMembers}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <span>👥</span>
          <span>
            {memberCount} member{memberCount !== 1 ? "s" : ""}
          </span>
          <span className="text-neon-green">●</span>
          <span className="text-neon-green">{onlineCount} online</span>
        </button>

        <div className="text-xs text-text-muted">
          Created by <span className="text-text-secondary">@{creatorUsername}</span>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && isCreator && (
        <div className="mt-4 p-4 bg-surface rounded-lg border border-border">
          <p className="text-sm text-text-muted mb-3">Admin Actions</p>
          <button
            onClick={handleDeleteRoom}
            disabled={deleting}
            className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? "Deleting..." : "🗑️ Delete Room"}
          </button>
        </div>
      )}
    </div>
  );
}
