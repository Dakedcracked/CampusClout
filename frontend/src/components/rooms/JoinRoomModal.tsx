"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Room } from "./RoomCard";

interface JoinRoomModalProps {
  room: Room;
  onClose: () => void;
  onJoinSuccess: () => void;
}

export default function JoinRoomModal({
  room,
  onClose,
  onJoinSuccess,
}: JoinRoomModalProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/rooms/${room.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          password: room.is_password_protected ? password : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 403) {
          setError("Incorrect password");
        } else {
          setError(data.detail || "Failed to join room");
        }
        return;
      }

      onJoinSuccess();

      // Show success toast
      const toast = document.createElement("div");
      toast.className =
        "fixed top-4 right-4 bg-neon-green/20 text-neon-green px-4 py-2 rounded-lg text-sm border border-neon-green/50 z-50";
      toast.textContent = `✓ Joined "${room.name}"!`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);

      // Redirect to room
      setTimeout(() => router.push(`/rooms/${room.id}`), 500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card rounded-lg p-6 w-full max-w-md shadow-xl"
        >
          <h2 className="text-xl font-bold text-text-primary mb-2">
            Join {room.name}
          </h2>

          {/* Room Info */}
          <div className="mb-4 p-3 bg-surface rounded-lg border border-border">
            <p className="text-sm text-text-secondary mb-2">
              {room.description || "No description provided"}
            </p>
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>👥 {room.member_count} members</span>
              <span>
                {room.is_public ? "Public" : "🔒 Private"}
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            {/* Password Input (if protected) */}
            {room.is_password_protected && (
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2">
                  This room is password protected
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-neon-purple/50"
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 btn-ghost text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  (room.is_password_protected && password.length === 0)
                }
                className="flex-1 btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Joining..." : "Join Room"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
