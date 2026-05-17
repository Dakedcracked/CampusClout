"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AlterEgo {
  id: string;
  alias: string;
  avatar_seed: string;
  is_active: boolean;
  created_at: string;
}

// Simple deterministic avatar using the seed to pick an emoji
const AVATARS = ["🦊", "🐺", "🦁", "🐯", "🐻", "🦝", "🐲", "👾", "🤖", "👻", "🧙", "🎭"];
function seedEmoji(seed: string): string {
  let n = 0;
  for (const c of seed) n = (n * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATARS[Math.abs(n) % AVATARS.length];
}

export default function AlterEgoToggle() {
  const [ae, setAe] = useState<AlterEgo | null | undefined>(undefined);
  const [alias, setAlias] = useState("");
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/v1/alter-ego", { credentials: "include" });
    if (res.ok) {
      const d = await res.json();
      setAe(d);
    } else {
      setAe(null);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/alter-ego", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ alias }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.detail ?? "Failed to create"); return; }
      setAe(d);
      setAlias("");
    } finally {
      setCreating(false);
    }
  }

  async function toggle() {
    setToggling(true);
    try {
      const res = await fetch("/api/v1/alter-ego/toggle", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) await load();
    } finally {
      setToggling(false);
    }
  }

  async function deleteAe() {
    await fetch("/api/v1/alter-ego", { method: "DELETE", credentials: "include" });
    setAe(null);
  }

  if (ae === undefined) return null; // loading

  return (
    <div className="glass-card p-6 flex flex-col gap-4">
      <div>
        <h2 className="font-semibold flex items-center gap-2">
          Alter-Ego
          {ae?.is_active && (
            <span className="text-xs clout-badge animate-pulse">ACTIVE</span>
          )}
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          One anonymous identity per account · Linked to your profile for moderation
        </p>
      </div>

      {!ae ? (
        <form onSubmit={create} className="flex gap-2">
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Choose an alias…"
            minLength={3}
            maxLength={32}
            required
            className="flex-1 bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm
                       text-text-primary placeholder-text-muted focus:outline-none focus:border-clout
                       transition-colors"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 text-sm bg-clout text-background font-semibold rounded-lg
                       hover:bg-clout-hover transition-colors disabled:opacity-50"
          >
            {creating ? "…" : "Create"}
          </button>
          {error && <p className="text-xs text-danger mt-1">{error}</p>}
        </form>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={ae.is_active ? "active" : "inactive"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl border transition-colors",
              ae.is_active
                ? "border-clout/40 bg-clout-dim/20"
                : "border-border bg-surface-raised"
            )}
          >
            <span className="text-3xl">{seedEmoji(ae.avatar_seed)}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">@{ae.alias}</p>
              <p className="text-xs text-text-muted">
                {ae.is_active ? "Posting as this identity" : "Inactive"}
              </p>
            </div>
            <button
              onClick={toggle}
              disabled={toggling}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
                ae.is_active
                  ? "bg-surface border border-border hover:bg-surface-raised text-text-muted"
                  : "bg-clout text-background hover:bg-clout-hover"
              )}
            >
              {toggling ? "…" : ae.is_active ? "Deactivate" : "Activate"}
            </button>
            <button
              onClick={deleteAe}
              className="text-xs text-text-muted hover:text-danger transition-colors"
              title="Delete alter-ego"
            >
              ✕
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
