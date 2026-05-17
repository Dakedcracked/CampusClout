"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

function useCountdown(targetIso: string | null) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!targetIso) return;
    const tick = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("00:00:00");
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setRemaining(
        [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return remaining;
}

export default function DailyDividend() {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);
  const [error, setError] = useState("");
  const countdown = useCountdown(nextAvailable);

  const claim = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/v1/economy/daily-dividend`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setAmount(data.amount);
        const next = new Date(data.claimed_at);
        next.setHours(next.getHours() + 24);
        setNextAvailable(next.toISOString());
      } else if (res.status === 429) {
        const detail: string = data.detail ?? "";
        const match = detail.match(/Next available at (.+)$/);
        if (match) setNextAvailable(match[1]);
        setError("Already claimed today.");
      } else {
        setError(data.detail ?? "Failed to claim dividend.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const canClaim = !nextAvailable || new Date(nextAvailable).getTime() <= Date.now();

  const copyReferral = () => {
    navigator.clipboard.writeText(`https://campusclout.edu/join?ref=${Math.random().toString(36).slice(2, 8)}`);
    alert("Referral link copied! Send it to 5 friends to unlock your next 100 ◈.");
  };

  return (
    <div className="bg-[#111] border border-[#262626] rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-orange-400" />
      
      <div className="flex items-center justify-between z-10 relative">
        <h3 className="font-black text-white text-[15px] flex items-center gap-2">
          🎁 Daily Dividend
        </h3>
      </div>

      {amount !== null && (
        <div className="bg-[#1a1a1a] rounded-xl p-3 text-center border border-[#333]">
          <p className="text-[#f09433] font-mono font-bold text-lg">
            +{amount} ◈
          </p>
          <p className="text-[10px] text-[#888] uppercase mt-0.5">Tokens Claimed</p>
        </div>
      )}

      {error && (
        <p className="text-red-500 text-xs font-semibold">{error}</p>
      )}

      {nextAvailable && !canClaim && (
        <div className="text-center py-2">
          <p className="text-[#555] text-xs font-semibold uppercase tracking-wider mb-1">Next bonus in</p>
          <p className="font-mono text-[#e0e0e0] text-2xl font-black tabular-nums tracking-tight">{countdown}</p>
        </div>
      )}

      <button
        onClick={claim}
        disabled={loading || !canClaim}
        className="w-full py-2.5 rounded-xl text-[13px] font-bold transition-all
          bg-white text-black hover:bg-gray-200
          disabled:opacity-20 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,255,255,0.1)]"
      >
        {loading ? "Claiming..." : canClaim ? "Claim Daily Bonus" : "Come back tomorrow"}
      </button>

      <div className="border-t border-[#262626] pt-4 mt-1">
        <p className="text-[#a3a3a3] text-xs mb-3 text-center font-medium leading-relaxed">
          Need more ◈ to unblur Top-Tier profiles?
        </p>
        <button
          onClick={copyReferral}
          className="w-full py-2 rounded-xl text-[12px] font-bold transition-all border border-[#f09433]/30 text-[#f09433] hover:bg-[#f09433]/10 flex items-center justify-center gap-2"
        >
          <span>🔗</span> Invite 5 Friends for 100 ◈
        </button>
      </div>
    </div>
  );
}
