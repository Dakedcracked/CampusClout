"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface WalletBalance {
  balance: number;
  total_earned: number;
  total_spent: number;
}

export default function WalletBadge() {
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const res = await fetch(`${API}/api/v1/wallet/balance`, {
          credentials: "include",
        });
        if (res.ok) {
          setWallet(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch wallet balance:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchBalance();
  }, []);

  if (loading || !wallet) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] text-[#fbbf24] font-semibold">
      <span>💰</span>
      <span>{wallet.balance}</span>
    </div>
  );
}
