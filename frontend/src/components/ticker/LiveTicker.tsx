"use client";

import { useMarketTicker } from "@/hooks/useMarketTicker";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function LiveTicker() {
  const { events, connected } = useMarketTicker();

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-widest">
          Live Market Feed
        </h2>
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs",
            connected ? "text-accent" : "text-text-muted"
          )}
        >
          <span
            className={cn(
              "inline-block w-1.5 h-1.5 rounded-full",
              connected ? "bg-accent animate-pulse" : "bg-border"
            )}
          />
          {connected ? "Live" : "Connecting…"}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-4">
          Waiting for market activity…
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
          <AnimatePresence initial={false}>
            {events.map((ev) => (
              <motion.li
                key={`${ev.user_id}-${ev.ts}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-raised text-sm"
              >
                <span className="font-medium truncate max-w-[120px]">
                  @{ev.username}
                </span>
                <span className="font-mono text-xs text-text-muted">
                  {ev.market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 })} cap
                </span>
                <span
                  className={cn(
                    "font-mono text-xs",
                    ev.delta >= 0 ? "text-accent" : "text-danger"
                  )}
                >
                  {ev.delta >= 0 ? "+" : ""}
                  {ev.delta_pct.toFixed(1)}%
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
