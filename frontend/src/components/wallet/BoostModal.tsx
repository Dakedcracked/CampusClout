"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface BoostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BoostModal({ isOpen, onClose }: BoostModalProps) {
  const [duration, setDuration] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handlePurchase() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/api/v1/wallet/boost?duration_hours=${duration}`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to purchase boost");
      }
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0f0f0f] border border-[#222] rounded-xl p-8 max-w-sm w-full mx-4">
        <h2 className="text-2xl font-bold text-white mb-2">🚀 Boost Your Profile</h2>
        <p className="text-[#888] mb-6">
          Get 50+ points to your trending score and 3x visibility
        </p>

        {success ? (
          <div className="text-center py-6">
            <p className="text-xl font-bold text-green-400">✓ Boost Activated!</p>
            <p className="text-[#888] mt-2">Your profile is now boosted for {duration} hours</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-white mb-2">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#9d4edd]"
              >
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={168}>7 days</option>
              </select>
            </div>

            <div className="mb-6 p-4 bg-[#1a1a1a] rounded-lg">
              <p className="text-sm text-[#888]">Cost</p>
              <p className="text-2xl font-bold text-[#fbbf24]">100 💰</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500 text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-lg bg-[#1a1a1a] text-white font-semibold hover:bg-[#222] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePurchase}
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-lg bg-[#9d4edd] text-white font-semibold hover:bg-[#b855ff] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Processing..." : "Buy Boost"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
