"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Profile {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  market_cap: number;
  beauty_coins: number;
  hot_count: number;
  not_count: number;
  vote_score: number;
  beauty_score: number | null;
  trending_score: number;
  engagement_7d: number;
  trending_breakdown?: { votes: number; beauty: number; market_cap: number; engagement: number };
  viewer_vote?: "hot" | "not" | null;
}

interface FullProfile extends Profile {
  bio?: string | null;
  university_domain?: string;
  is_following?: boolean;
  posts?: { id: string; content: string; like_count: number; comment_count: number; created_at: string }[];
  follower_count?: number;
  following_count?: number;
}

const RANK_LABELS = ["🥇", "🥈", "🥉"];
const igColors = ["#9d4edd", "#f472b6", "#60a5fa", "#00e5a0", "#fbbf24", "#f97316", "#22d3ee"];

function Avatar({ user, size = 48, story = false }: { user: Profile; size?: number; story?: boolean }) {
  const bg = igColors[user.username.charCodeAt(0) % igColors.length];
  const letter = ((user.display_name ?? user.username)?.[0] ?? "?").toUpperCase();

  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar_url}
        alt={user.username}
        className={`rounded-full object-cover flex-shrink-0 ${story ? "story-ring" : ""}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center font-black text-white flex-shrink-0 ${story ? "story-ring" : ""}`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${bg}, ${bg}cc)`, fontSize: size * 0.38 }}
    >
      {letter}
    </div>
  );
}

function HotBar({ hot, not }: { hot: number; not: number }) {
  const total = hot + not;
  const pct = total > 0 ? Math.round((hot / total) * 100) : 50;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#f09433] font-bold w-8">{pct}%</span>
      <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div className="h-full hot-gradient rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-[#555]">{total} votes</span>
    </div>
  );
}

export default function TrendingProfiles({ myUsername }: { myUsername: string }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);
  const [selected, setSelected] = useState<FullProfile | null>(null);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"grid" | "list">("list");

  useEffect(() => {
    fetch(`${API}/api/v1/profiles/trending?limit=20`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setProfiles(d))
      .finally(() => setLoading(false));
  }, []);

  async function vote(username: string, voteType: "hot" | "not") {
    if (username === myUsername || voting) return;
    setVoting(username);
    try {
      const res = await fetch(`${API}/api/v1/profiles/${username}/vote`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote_type: voteType }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfiles((prev) => prev.map((p) =>
          p.username === username ? { ...p, hot_count: data.hot_count, not_count: data.not_count, vote_score: data.vote_score, viewer_vote: voteType } : p
        ));
        if (selected?.username === username) {
          setSelected((s) => s ? { ...s, hot_count: data.hot_count, not_count: data.not_count, viewer_vote: voteType } : s);
        }
      }
    } finally { setVoting(null); }
  }

  async function openProfile(p: Profile) {
    setSelected(p as FullProfile);
    try {
      const res = await fetch(`${API}/api/v1/profiles/${p.username}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSelected({ ...p, ...data });
        if (data.is_following !== undefined) {
          setFollowing((prev) => ({ ...prev, [p.username]: data.is_following }));
        }
      }
    } catch {}
  }

  async function toggleFollow(username: string) {
    if (followLoading) return;
    setFollowLoading(username);
    try {
      const res = await fetch(`${API}/api/v1/profiles/${username}/follow`, {
        method: "POST", credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setFollowing((prev) => ({ ...prev, [username]: data.is_following }));
      }
    } finally { setFollowLoading(null); }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="trending-card p-4 flex items-center gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-[#1a1a1a]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-[#1a1a1a] rounded w-1/3" />
              <div className="h-2 bg-[#1a1a1a] rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white">Trending</h1>
            <span className="text-2xl animate-float">🔥</span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f09433]/15 border border-[#f09433]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f09433] animate-pulse" />
              <span className="text-[10px] text-[#f09433] font-semibold">LIVE</span>
            </span>
          </div>
          <p className="text-xs text-[#555] mt-0.5">Ranked by votes · beauty score · market cap · engagement</p>
        </div>
        <div className="flex gap-1 bg-[#161616] rounded-lg p-1">
          {(["list", "grid"] as const).map((v) => (
            <button key={v} onClick={() => setActiveView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView === v ? "bg-[#262626] text-white" : "text-[#555] hover:text-[#888]"}`}>
              {v === "list" ? "≡" : "⊞"}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Profile list */}
      <div className={activeView === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}>
        {profiles.map((profile, idx) => {
          const isMe = profile.username === myUsername;
          const rankLabel = profile.rank <= 3 ? RANK_LABELS[profile.rank - 1] : null;

          if (activeView === "grid") {
            return (
              <motion.div key={profile.user_id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.04 }}
                className="trending-card p-4 cursor-pointer flex flex-col items-center gap-3 text-center"
                onClick={() => openProfile(profile)}>
                <div className="relative">
                  <Avatar user={profile} size={64} story />
                  <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-[#111] border border-[#222] flex items-center justify-center text-sm">
                    {rankLabel ?? <span className="text-[10px] text-[#555] font-mono">#{profile.rank}</span>}
                  </div>
                </div>
                <div>
                  <p className="font-bold text-sm text-white truncate max-w-[120px]">{profile.display_name ?? profile.username}</p>
                  <p className="text-xs text-[#555]">@{profile.username}</p>
                </div>
                <HotBar hot={profile.hot_count} not={profile.not_count} />
                {!isMe && (
                  <div className="flex gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => vote(profile.username, "hot")} disabled={!!voting || profile.viewer_vote === "hot"}
                      className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all ${profile.viewer_vote === "hot" ? "bg-[#f09433] text-black" : "border border-[#f09433]/40 text-[#f09433] hover:bg-[#f09433]/15"} disabled:opacity-50`}>
                      🔥 Hot
                    </button>
                    <button onClick={() => vote(profile.username, "not")} disabled={!!voting || profile.viewer_vote === "not"}
                      className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all ${profile.viewer_vote === "not" ? "bg-[#60a5fa] text-black" : "border border-[#60a5fa]/40 text-[#60a5fa] hover:bg-[#60a5fa]/15"} disabled:opacity-50`}>
                      ❄️ Not
                    </button>
                  </div>
                )}
              </motion.div>
            );
          }

          return (
            <motion.div key={profile.user_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="trending-card p-3.5 flex items-center gap-3 cursor-pointer"
              onClick={() => openProfile(profile)}>
              {/* Rank */}
              <div className="w-8 text-center flex-shrink-0">
                {rankLabel ? (
                  <span className="text-xl">{rankLabel}</span>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center mx-auto">
                    <span className="text-[10px] text-[#444] font-mono font-bold">{profile.rank}</span>
                  </div>
                )}
              </div>

              <Avatar user={profile} size={44} story />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white truncate">{profile.display_name ?? profile.username}</span>
                  {profile.beauty_score !== null && profile.beauty_score >= 7 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-900/30 text-pink-400 font-medium">✨ {Math.round(profile.beauty_score)}</span>
                  )}
                </div>
                <p className="text-xs text-[#555]">@{profile.username}</p>
                <div className="mt-1.5">
                  <HotBar hot={profile.hot_count} not={profile.not_count} />
                </div>
              </div>

              {/* Stats */}
              <div className="text-right flex-shrink-0 hidden sm:block mr-2">
                <p className="font-mono text-sm font-bold text-[#a78bfa]">
                  {profile.market_cap >= 1000 ? `${(profile.market_cap / 1000).toFixed(1)}k` : profile.market_cap.toFixed(0)}
                </p>
                <p className="text-[10px] text-[#444]">cap</p>
              </div>

              {/* Vote buttons */}
              {!isMe && (
                <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => vote(profile.username, "hot")}
                    disabled={!!voting || profile.viewer_vote === "hot"}
                    className={`w-9 h-9 rounded-xl text-sm transition-all flex items-center justify-center ${profile.viewer_vote === "hot" ? "bg-[#f09433] text-black" : "bg-[#1a1a1a] hover:bg-[#f09433]/20 hover:text-[#f09433]"} disabled:opacity-40`}
                  >🔥</button>
                  <button
                    onClick={() => vote(profile.username, "not")}
                    disabled={!!voting || profile.viewer_vote === "not"}
                    className={`w-9 h-9 rounded-xl text-sm transition-all flex items-center justify-center ${profile.viewer_vote === "not" ? "bg-[#60a5fa] text-black" : "bg-[#1a1a1a] hover:bg-[#60a5fa]/20 hover:text-[#60a5fa]"} disabled:opacity-40`}
                  >❄️</button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {profiles.length === 0 && (
        <div className="text-center py-20">
          <p className="text-5xl mb-4 animate-float">🌟</p>
          <p className="text-[#444] text-sm">No trending profiles yet — be the first to get voted on!</p>
        </div>
      )}

      {/* Profile detail sheet */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="bg-[#111] border border-[#222] rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Profile hero */}
              <div className="relative">
                {/* Gradient header */}
                <div className="h-24 rounded-t-3xl" style={{
                  background: `linear-gradient(135deg, ${igColors[selected.username.charCodeAt(0) % igColors.length]}40, transparent)`
                }} />
                <div className="absolute top-4 right-4">
                  <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full bg-black/60 text-white text-sm flex items-center justify-center hover:bg-black/80 transition-colors">✕</button>
                </div>
                <div className="absolute -bottom-8 left-5">
                  <Avatar user={selected} size={72} story />
                </div>
              </div>

              <div className="pt-12 px-5 pb-5">
                {/* Name + follow */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-xl font-black text-white">{selected.display_name ?? selected.username}</h2>
                    <p className="text-[#555] text-sm">@{selected.username}</p>
                    {selected.university_domain && <p className="text-[#444] text-xs mt-0.5">🎓 {selected.university_domain}</p>}
                  </div>
                  {selected.username !== myUsername && (
                    <button
                      onClick={() => toggleFollow(selected.username)}
                      disabled={followLoading === selected.username}
                      className={`${following[selected.username] ? "btn-ig-outline" : "btn-ig"} disabled:opacity-50`}
                    >
                      {followLoading === selected.username ? "…" : following[selected.username] ? "Following" : "Follow"}
                    </button>
                  )}
                </div>

                {selected.bio && (
                  <p className="text-sm text-[#aaa] mb-4 leading-relaxed">{selected.bio}</p>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {[
                    { label: "Cap", value: selected.market_cap >= 1000 ? `${(selected.market_cap / 1000).toFixed(1)}k` : selected.market_cap.toFixed(0), color: "#a78bfa" },
                    { label: "Followers", value: (selected.follower_count ?? 0).toLocaleString(), color: "#60a5fa" },
                    { label: "Beauty Score", value: selected.beauty_score ? `${selected.beauty_score.toFixed(1)}/10` : "—", color: "#f472b6" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-[#161616] rounded-2xl p-3 text-center">
                      <p className="font-black font-mono text-base" style={{ color }}>{value}</p>
                      <p className="text-[10px] text-[#444] mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Hot/Not voting */}
                {selected.username !== myUsername && (
                  <div className="mb-5">
                    <p className="text-xs text-[#444] uppercase tracking-wider mb-2 font-semibold">Community Rating</p>
                    <HotBar hot={selected.hot_count} not={selected.not_count} />
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => vote(selected.username, "hot")} disabled={!!voting || selected.viewer_vote === "hot"}
                        className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${selected.viewer_vote === "hot" ? "bg-[#f09433] text-black" : "border border-[#f09433]/40 text-[#f09433] hover:bg-[#f09433]/15"} disabled:opacity-50`}>
                        🔥 Hot <span className="font-mono text-xs opacity-70">({selected.hot_count})</span>
                      </button>
                      <button onClick={() => vote(selected.username, "not")} disabled={!!voting || selected.viewer_vote === "not"}
                        className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${selected.viewer_vote === "not" ? "bg-[#60a5fa] text-black" : "border border-[#60a5fa]/40 text-[#60a5fa] hover:bg-[#60a5fa]/15"} disabled:opacity-50`}>
                        ❄️ Not <span className="font-mono text-xs opacity-70">({selected.not_count})</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Trending breakdown */}
                {selected.trending_breakdown && (
                  <div className="mb-5 bg-[#161616] rounded-2xl p-4">
                    <p className="text-xs text-[#555] uppercase tracking-wider mb-3 font-semibold">Trending Score — {selected.trending_score.toFixed(1)}/100</p>
                    {[
                      { label: "Votes", value: selected.trending_breakdown.votes, color: "#f09433" },
                      { label: "Beauty AI", value: selected.trending_breakdown.beauty, color: "#f472b6" },
                      { label: "Market Cap", value: selected.trending_breakdown.market_cap, color: "#a78bfa" },
                      { label: "Engagement", value: selected.trending_breakdown.engagement, color: "#60a5fa" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex items-center gap-3 mb-2 last:mb-0">
                        <span className="text-xs text-[#555] w-20">{label}</span>
                        <div className="flex-1 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min((value / 35) * 100, 100)}%`, background: color }} />
                        </div>
                        <span className="text-xs font-mono text-[#888] w-8 text-right">{value.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent posts */}
                {(selected as FullProfile).posts && (selected as FullProfile).posts!.length > 0 && (
                  <div>
                    <p className="text-xs text-[#555] uppercase tracking-wider mb-3 font-semibold">Recent Posts</p>
                    <div className="flex flex-col gap-2">
                      {(selected as FullProfile).posts!.slice(0, 3).map((p) => (
                        <div key={p.id} className="bg-[#161616] rounded-xl p-3">
                          <p className="text-sm text-[#bbb] leading-relaxed line-clamp-2">{p.content}</p>
                          <div className="flex gap-3 mt-2 text-xs text-[#444]">
                            <span>♥ {p.like_count}</span>
                            <span>💬 {p.comment_count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
