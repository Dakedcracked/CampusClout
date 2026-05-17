"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface LeaderEntry {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  market_cap: number;
  tokens_invested_in_me: number;
}

interface MarketEvent {
  username: string;
  display_name: string | null;
  market_cap: number;
  delta: number;
  delta_pct: number;
  timestamp: number;
}

// Generate synthetic sparkline for a user based on cap + variance
function generateSparkline(cap: number, points = 20) {
  const data = [];
  let val = cap * 0.7;
  for (let i = 0; i < points; i++) {
    val = val + (Math.random() - 0.45) * cap * 0.04;
    val = Math.max(0, val);
    data.push({ t: i, v: Math.round(val) });
  }
  data.push({ t: points, v: cap });
  return data;
}

// Custom tooltip
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; name?: string }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-2.5 text-xs border-neon-purple/30">
      {payload.map((p, i) => (
        <div key={i} className="font-mono text-text-primary">
          {p.name && <span className="text-text-muted mr-1">{p.name}:</span>}
          <span className="font-bold">{p.value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
      ))}
    </div>
  );
}

export default function MarketDashboard({
  myUsername,
  myBalance,
}: {
  myUsername: string;
  myBalance?: { wallet_balance: number; market_cap: number; tokens_invested_in_me: number };
}) {
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [investing, setInvesting] = useState<string | null>(null);
  const [investAmount, setInvestAmount] = useState<Record<string, number>>({});
  const [investMsg, setInvestMsg] = useState<Record<string, string>>({});
  const [activeChart, setActiveChart] = useState<"caps" | "volume" | "sparklines">("caps");

  const load = useCallback(async () => {
    const r = await fetch(`${API}/api/v1/economy/leaderboard?limit=20`);
    if (r.ok) setLeaderboard(await r.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  // Listen to WS market events
  useEffect(() => {
    const API_WS = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace("http", "ws");
    let ws: WebSocket;
    let ping: ReturnType<typeof setInterval>;
    (async () => {
      try {
        const tr = await fetch(`${API}/api/v1/auth/ws-ticket`, { method: "POST", credentials: "include" });
        if (!tr.ok) return;
        const { ticket } = await tr.json();
        ws = new WebSocket(`${API_WS}/api/v1/ws/ticker?ticket=${ticket}`);
        ws.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data);
            if (d.event === "market_cap_update") {
              setEvents(prev => [{ ...d, timestamp: Date.now() }, ...prev].slice(0, 50));
              setLeaderboard(prev => prev.map(u => u.username === d.username ? { ...u, market_cap: d.market_cap } : u));
            }
          } catch {}
        };
        ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send("ping"), 25000);
        ws.onclose = () => clearInterval(ping);
      } catch {}
    })();
    return () => { clearInterval(ping); ws?.close(); };
  }, []);

  async function doInvest(username: string) {
    const amount = investAmount[username] || 10;
    setInvesting(username);
    try {
      const r = await fetch(`${API}/api/v1/economy/invest`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_username: username, amount }),
      });
      const d = await r.json();
      if (r.ok) {
        setInvestMsg(prev => ({ ...prev, [username]: `✓ Invested ${amount}◈` }));
        setTimeout(() => setInvestMsg(prev => ({ ...prev, [username]: "" })), 2000);
        load();
      } else {
        setInvestMsg(prev => ({ ...prev, [username]: d.detail ?? "Failed" }));
      }
    } finally {
      setInvesting(null);
    }
  }

  const chartData = leaderboard.slice(0, 10).map(u => ({
    name: u.username.slice(0, 8),
    cap: Math.round(u.market_cap),
    invested: u.tokens_invested_in_me,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* My stats banner */}
      {myBalance && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card-glow p-5 grid grid-cols-3 gap-4">
          {[
            { label: "My Wallet", value: `◈ ${myBalance.wallet_balance.toLocaleString()}`, color: "text-accent" },
            { label: "My Market Cap", value: myBalance.market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 }), color: "text-clout" },
            { label: "Invested In Me", value: `◈ ${myBalance.tokens_invested_in_me.toLocaleString()}`, color: "text-neon-blue" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={`text-2xl font-black font-mono ${s.color}`}>{s.value}</div>
              <div className="text-xs text-text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Chart tabs */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg gradient-text">Market Charts</h3>
          <div className="flex gap-1 bg-surface rounded-lg p-1">
            {(["caps", "volume", "sparklines"] as const).map(t => (
              <button key={t} onClick={() => setActiveChart(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${activeChart === t ? "tab-active" : "text-text-muted hover:text-text-primary"}`}>
                {t === "caps" ? "Market Caps" : t === "volume" ? "Investment" : "Price Chart"}
              </button>
            ))}
          </div>
        </div>

        {activeChart === "caps" && (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1d35" />
              <XAxis dataKey="name" tick={{ fill: "#606080", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#606080", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="cap" name="Market Cap" fill="url(#capGrad)" radius={[6, 6, 0, 0]} />
              <defs>
                <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9d4edd" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#f472b6" stopOpacity={0.6} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeChart === "volume" && (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1d35" />
              <XAxis dataKey="name" tick={{ fill: "#606080", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#606080", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="invested" name="Invested In" fill="url(#volGrad)" radius={[6, 6, 0, 0]} />
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00e5a0" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#00c88a" stopOpacity={0.5} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeChart === "sparklines" && (
          <div className="grid grid-cols-2 gap-4">
            {leaderboard.slice(0, 6).map((u, i) => {
              const spark = generateSparkline(u.market_cap);
              const color = ["#9d4edd", "#f472b6", "#00e5a0", "#60a5fa", "#fbbf24", "#22d3ee"][i % 6];
              return (
                <div key={u.user_id} className="bg-surface-raised rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-text-primary">@{u.username}</span>
                    <span className="text-xs font-mono" style={{ color }}>
                      {u.market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={60}>
                    <AreaChart data={spark} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id={`sg${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#sg${i})`} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live events feed */}
      {events.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-bold mb-3 text-sm text-text-muted uppercase tracking-widest">Live Market Activity</h3>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
            {events.slice(0, 10).map((ev, i) => (
              <motion.div key={`${ev.username}-${ev.timestamp}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 text-sm">
                <span className={`font-mono text-xs font-bold ${ev.delta >= 0 ? "text-accent" : "text-danger"}`}>
                  {ev.delta >= 0 ? "▲" : "▼"} {Math.abs(ev.delta_pct).toFixed(1)}%
                </span>
                <span className="text-text-secondary">@{ev.username}</span>
                <span className="text-text-muted text-xs ml-auto font-mono">
                  {ev.market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 })} cap
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard + invest */}
      <div className="glass-card p-5">
        <h3 className="font-bold text-lg gradient-text mb-4">Campus Rankings</h3>
        <div className="flex flex-col gap-2">
          {leaderboard.map((entry, i) => {
            const isMe = entry.username === myUsername;
            return (
              <motion.div key={entry.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className={`rounded-2xl p-4 flex items-center gap-4 transition-all ${isMe ? "border border-neon-purple/40" : "bg-surface-raised hover:bg-border/20"}`}
                style={isMe ? { background: "linear-gradient(135deg, #9d4edd15, #f472b610)" } : {}}>
                <span className="font-mono text-sm w-6 text-center font-bold"
                  style={{ color: i === 0 ? "#fbbf24" : i === 1 ? "#d1d5db" : i === 2 ? "#fb923c" : "#606080" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${entry.rank}`}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-text-primary truncate">{entry.display_name ?? entry.username}</span>
                    {isMe && <span className="neon-badge text-[10px]">you</span>}
                  </div>
                  <span className="text-xs text-text-muted">@{entry.username}</span>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-sm text-clout font-bold">
                    {entry.market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[10px] text-text-muted">cap</div>
                </div>

                {!isMe && (
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <input
                      type="number" min={1} max={500} placeholder="◈"
                      value={investAmount[entry.username] ?? ""}
                      onChange={e => setInvestAmount(prev => ({ ...prev, [entry.username]: parseInt(e.target.value) || 10 }))}
                      className="w-16 bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary text-center focus:outline-none focus:border-neon-purple"
                    />
                    <button
                      onClick={() => doInvest(entry.username)}
                      disabled={investing === entry.username}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all btn-primary"
                    >
                      {investMsg[entry.username] || (investing === entry.username ? "…" : "Invest")}
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
