"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import type { Room } from "./RoomCard";

interface CreateRoomModalProps {
  onClose: () => void;
  onCreated: (room: Room) => void;
}

export default function CreateRoomModal({
  onClose,
  onCreated,
}: CreateRoomModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFormValid =
    name.trim().length > 0 &&
    name.length <= 100 &&
    (!isPasswordProtected ||
      (password.length >= 6 && password === confirmPassword));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          is_password_protected: isPasswordProtected,
          password: isPasswordProtected ? password : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to create room");
        return;
      }

      const newRoom = await res.json();
      onCreated(newRoom);

      // Show success toast and redirect
      const toast = document.createElement("div");
      toast.className =
        "fixed top-4 right-4 bg-neon-green/20 text-neon-green px-4 py-2 rounded-lg text-sm border border-neon-green/50 z-50";
      toast.textContent = `✓ Room "${name}" created!`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
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
          <h2 className="text-xl font-bold text-text-primary mb-4">
            Create a New Room
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Room Name */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2">
                Room Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Study Group 2024"
                maxLength={100}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-neon-purple/50"
              />
              <p className="text-[10px] text-text-muted mt-1">
                {name.length}/100
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this room about?"
                maxLength={500}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-neon-purple/50 resize-none"
              />
              <p className="text-[10px] text-text-muted mt-1">
                {description.length}/500
              </p>
            </div>

            {/* Password Protection */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="password-protected"
                checked={isPasswordProtected}
                onChange={(e) => {
                  setIsPasswordProtected(e.target.checked);
                  if (!e.target.checked) {
                    setPassword("");
                    setConfirmPassword("");
                  }
                }}
                className="rounded"
              />
              <label htmlFor="password-protected" className="text-sm text-text-secondary">
                Password protected
              </label>
            </div>

            {/* Password Fields */}
            {isPasswordProtected && (
              <div className="flex flex-col gap-3 p-3 bg-surface rounded-lg border border-border">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2">
                    Password (min 6 chars)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-neon-purple/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-neon-purple/50"
                  />
                </div>

                {password !== confirmPassword && confirmPassword && (
                  <p className="text-xs text-red-400">Passwords do not match</p>
                )}
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
                disabled={!isFormValid || loading}
                className="flex-1 btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Room"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
