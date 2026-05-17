"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface StreakData {
  streak: number;
  longest: number;
  bonus_tokens: number;
  already_checked_in: boolean;
}

export default function StreakBanner() {
  const [data, setData] = useState<StreakData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only call once per session (store in sessionStorage)
    if (sessionStorage.getItem("streak_checked")) return;
    sessionStorage.setItem("streak_checked", "1");

    fetch("/api/v1/feed/streak/checkin", { method: "POST", credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || d.already_checked_in) return;
        setData(d);
        setVisible(true);
        // Auto-dismiss after 5s
        setTimeout(() => setVisible(false), 5000);
      })
      .catch(() => {});
  }, []);

  const streakEmoji = (n: number) => {
    if (n >= 30) return "🏆";
    if (n >= 14) return "💎";
    if (n >= 7) return "🔥";
    if (n >= 3) return "⚡";
    return "✨";
  };

  return (
    <AnimatePresence>
      {visible && data && (
        <motion.div
          initial={{ opacity: 0, y: -60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -60, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] w-[calc(100%-2rem)] max-w-sm"
        >
          <div className="bg-gradient-to-r from-[#1a0a2e] to-[#0d1a2e] border border-[#9d4edd]/40 rounded-2xl px-5 py-4 shadow-[0_8px_32px_rgba(157,78,221,0.3)] flex items-center gap-4">
            {/* Streak icon */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9d4edd] to-[#f472b6] flex items-center justify-center text-2xl">
                {streakEmoji(data.streak)}
              </div>
              {/* Streak count badge */}
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#f09433] flex items-center justify-center text-[10px] font-black text-black">
                {data.streak}
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm leading-tight">
                {data.streak === 1 ? "Welcome back! 👋" : `${data.streak}-Day Streak! ${streakEmoji(data.streak)}`}
              </p>
              <p className="text-xs text-[#aaa] mt-0.5">
                {data.bonus_tokens > 0
                  ? `+${data.bonus_tokens} ◈ clout tokens earned`
                  : "Keep logging in daily for bonus tokens!"}
              </p>
              {data.streak >= 3 && (
                <div className="flex gap-0.5 mt-1.5">
                  {Array.from({ length: Math.min(data.streak, 7) }).map((_, i) => (
                    <div key={i} className="h-1 flex-1 rounded-full bg-gradient-to-r from-[#9d4edd] to-[#f472b6]" />
                  ))}
                  {data.streak < 7 && Array.from({ length: 7 - data.streak }).map((_, i) => (
                    <div key={i} className="h-1 flex-1 rounded-full bg-[#333]" />
                  ))}
                </div>
              )}
            </div>

            {/* Close */}
            <button
              onClick={() => setVisible(false)}
              className="text-[#555] hover:text-white text-lg flex-shrink-0 transition-colors"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
