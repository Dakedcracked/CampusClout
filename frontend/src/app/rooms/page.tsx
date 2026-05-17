"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RoomList from "@/components/rooms/RoomList";

export default function RoomsPage() {
  const router = useRouter();
  const [, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (res.ok) {
          setUser(await res.json());
        } else {
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-neon-purple border-t-transparent animate-spin" />
        <div className="gradient-text font-mono font-bold">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              ←
            </button>
            <span className="text-xl font-black gradient-text tracking-tight">
              Rooms
            </span>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="btn-ghost text-xs"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <RoomList />
      </main>
    </div>
  );
}
