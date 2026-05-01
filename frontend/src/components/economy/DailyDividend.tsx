"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎁</span>
        <h3 className="font-semibold text-sm text-text-primary">Daily Dividend</h3>
      </div>

      {amount !== null && (
        <p className="text-accent font-mono text-sm">
          +{amount} tokens claimed!
        </p>
      )}

      {error && (
        <p className="text-danger text-xs">{error}</p>
      )}

      {nextAvailable && !canClaim && (
        <div className="text-center">
          <p className="text-text-muted text-xs mb-1">Next bonus in</p>
          <p className="font-mono text-accent text-lg tabular-nums">{countdown}</p>
        </div>
      )}

      <button
        onClick={claim}
        disabled={loading || !canClaim}
        className="w-full py-2 rounded-lg text-sm font-medium transition-all
          bg-accent text-black hover:bg-accent/90
          disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Claiming..." : canClaim ? "Claim Daily Bonus" : "Come back tomorrow"}
      </button>

      <p className="text-text-muted text-xs text-center">
        10 – 50 Clout Tokens, once every 24 hours
      </p>
    </div>
  );
}
