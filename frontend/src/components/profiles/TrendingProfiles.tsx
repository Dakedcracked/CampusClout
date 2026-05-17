"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TrendingPost {
  id: string;
  author_username: string;
  author_display_name: string | null;
  author_avatar_url: string | null;
  author_market_cap: number;
  content: string;
  like_count: number;
  comment_count: number;
  rank_score: number;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
}


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
  trending_breakdown?: { votes: number; beauty: number; market_cap: number; engagement: number };
  trending_pics?: string[];
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
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);
  const [selected, setSelected] = useState<FullProfile | null>(null);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"swipe" | "grid" | "list">("swipe");
  const [currentPicIndex, setCurrentPicIndex] = useState<Record<string, number>>({});
  const [scope, setScope] = useState<"campus" | "global">("global");

  useEffect(() => {
    setLoading(true);
    const queryScope = scope === "campus" ? "&campus_only=true" : "";
    Promise.all([
      fetch(`/api/v1/profiles/trending?limit=20${queryScope}`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch("/api/v1/feed/trending?limit=10", { credentials: "include" }).then(r => r.ok ? r.json() : []),
    ]).then(([profilesData, postsData]) => {
      setProfiles(profilesData);
      setTrendingPosts(postsData);
    }).finally(() => setLoading(false));
  }, [scope]);

  async function vote(username: string, voteType: "hot" | "not") {
    if (username === myUsername || voting) return;
    setVoting(username);
    try {
      const res = await fetch(`/api/v1/profiles/${username}/vote`, {
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
    window.location.href = `/profile/${p.username}`;
  }

  async function toggleFollow(username: string) {
    if (followLoading) return;
    setFollowLoading(username);
    try {
      const res = await fetch(`/api/v1/profiles/${username}/follow`, {
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
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-white">Trending</h1>
            <span className="text-2xl animate-float">🔥</span>
          </div>
          <div className="flex items-center gap-2 bg-[#161616] rounded-full p-1 w-fit mt-1 border border-[#262626]">
            <button onClick={() => setScope("global")}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${scope === "global" ? "bg-[#333] text-white" : "text-[#777] hover:text-[#aaa]"}`}>
              Global
            </button>
            <button onClick={() => setScope("campus")}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${scope === "campus" ? "bg-[#333] text-white" : "text-[#777] hover:text-[#aaa]"}`}>
              My Campus
            </button>
          </div>
        </div>
        <div className="flex gap-1 bg-[#161616] rounded-lg p-1">
          {(["swipe", "list", "grid"] as const).map((v) => (
            <button key={v} onClick={() => setActiveView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView === v ? "bg-[#262626] text-white" : "text-[#555] hover:text-[#888]"}`}>
              {v === "swipe" ? "💎" : v === "list" ? "≡" : "⊞"}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Profile list / deck */}
      <div className={activeView === "grid" ? "grid grid-cols-2 gap-3" : activeView === "swipe" ? "relative h-[400px] w-full max-w-sm mx-auto perspective-1000" : "flex flex-col gap-2"}>
        {activeView === "swipe" && (
          <>
            {profiles.filter(p => !p.viewer_vote && p.username !== myUsername).length > 0 ? (
              <AnimatePresence>
                {profiles.filter(p => !p.viewer_vote && p.username !== myUsername).slice(0, 1).map((profile) => (
                  <motion.div
                    key={profile.user_id}
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={(e, info) => {
                      if (info.offset.x > 100) vote(profile.username, "hot");
                      else if (info.offset.x < -100) vote(profile.username, "not");
                    }}
                    className="absolute inset-0 bg-[#121212] border border-[#262626] rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-2xl cursor-grab active:cursor-grabbing"
                  >
                    <div className="relative group cursor-pointer w-full h-[240px]" onClick={(e) => {
                      // Click to change photo
                      if (profile.trending_pics && profile.trending_pics.length > 1) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isRight = e.clientX - rect.left > rect.width / 2;
                        setCurrentPicIndex(prev => {
                          const current = prev[profile.username] || 0;
                          const next = isRight 
                            ? (current + 1) % profile.trending_pics!.length 
                            : (current - 1 + profile.trending_pics!.length) % profile.trending_pics!.length;
                          return { ...prev, [profile.username]: next };
                        });
                      } else if (profile.market_cap > 5000 && !profile.viewer_vote) {
                        e.stopPropagation();
                        if (confirm(`Spend 5 ◈ to unblur @${profile.username}?`)) {
                          alert("Unblurred! 5 ◈ deducted.");
                        }
                      }
                    }}>
                      <div className={`w-full h-full rounded-2xl overflow-hidden ${profile.market_cap > 5000 ? "blur-md transition-all duration-500 group-hover:blur-sm" : ""}`}>
                        {profile.trending_pics && profile.trending_pics.length > 0 ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={profile.trending_pics[currentPicIndex[profile.username] || 0]} alt={profile.username} className="w-full h-full object-cover" />
                            {profile.trending_pics.length > 1 && (
                              <div className="absolute top-2 left-0 right-0 flex gap-1 px-2">
                                {profile.trending_pics.map((_, i) => (
                                  <div key={i} className={`h-1 flex-1 rounded-full ${i === (currentPicIndex[profile.username] || 0) ? "bg-white" : "bg-white/40"}`} />
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                            <Avatar user={profile} size={120} story />
                          </div>
                        )}
                      </div>
                      {profile.market_cap > 5000 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-2xl">
                          <span className="text-2xl mb-1">🔒</span>
                          <span className="text-[10px] font-bold bg-[#f09433] text-black px-2 py-0.5 rounded-full">5 ◈ to Reveal</span>
                        </div>
                      )}
                    </div>
                    
                    <h2 className="text-2xl font-black text-white mt-4 flex items-center gap-2">
                      {profile.market_cap > 5000 ? "Anonymous Top Tier" : (profile.display_name ?? profile.username)}
                      {profile.beauty_score && profile.beauty_score >= 8 && <span className="text-sm">✨</span>}
                    </h2>
                    <p className="text-sm text-[#a3a3a3]">@{profile.market_cap > 5000 ? "hidden_user" : profile.username}</p>
                    <div className="mt-4 w-full">
                      <HotBar hot={profile.hot_count} not={profile.not_count} />
                    </div>
                    <div className="flex gap-4 mt-8 w-full justify-center">
                      <button onClick={(e) => { e.stopPropagation(); vote(profile.username, "not"); }}
                        className="w-14 h-14 rounded-full bg-[#1a1a1a] border border-[#262626] flex items-center justify-center text-2xl hover:bg-[#60a5fa]/20 transition-colors">
                        ❄️
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); vote(profile.username, "hot"); }}
                        className="w-14 h-14 rounded-full bg-[#1a1a1a] border border-[#262626] flex items-center justify-center text-2xl hover:bg-[#f09433]/20 transition-colors">
                        🔥
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-4xl mb-4">🏆</span>
                <p className="text-[#a3a3a3] font-medium">You've voted on everyone trending!</p>
              </div>
            )}
          </>
        )}
        
        {activeView !== "swipe" && profiles.map((profile, idx) => {
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
          <p className="text-white font-semibold mb-2">No trending profiles yet</p>
          <p className="text-[#555] text-sm max-w-sm mx-auto leading-relaxed">
            Be the first to build your profile and get voted on! Get more votes and engagement to climb the rankings.
          </p>
        </div>
      )}

      {/* ── Trending Posts Section ── */}
      {trendingPosts.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-black text-white">Trending Posts</h2>
            <span className="text-lg">📈</span>
            <span className="text-[10px] text-[#555] uppercase tracking-wider ml-auto">Ranked by clout</span>
          </div>
          <div className="flex flex-col gap-3">
            {trendingPosts.map((post, idx) => {
              const bg = igColors[post.author_username.charCodeAt(0) % igColors.length];
              return (
                <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-[#121212] border border-[#1e1e1e] rounded-2xl p-4 hover:border-[#333] transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    {post.author_avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.author_avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${bg}, ${bg}cc)` }}>
                        {(post.author_display_name ?? post.author_username)?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white truncate">{post.author_display_name ?? post.author_username}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#a78bfa]/15 text-[#a78bfa] font-mono">
                          {post.author_market_cap >= 1000 ? `${(post.author_market_cap / 1000).toFixed(1)}k` : post.author_market_cap.toFixed(0)} ◈
                        </span>
                      </div>
                      <p className="text-xs text-[#555]">@{post.author_username}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-[#f09433] font-bold">#{idx + 1}</p>
                    </div>
                  </div>
                  <p className="text-[15px] text-[#ddd] leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  {post.media_url && post.media_type === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.media_url} alt="" className="rounded-xl mt-3 w-full max-h-64 object-cover border border-[#1e1e1e]"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-[#555]">
                    <span className="flex items-center gap-1">♥ {post.like_count}</span>
                    <span className="flex items-center gap-1">💬 {post.comment_count}</span>
                    <span className="ml-auto text-[10px] font-mono text-[#333]">score {post.rank_score.toFixed(1)}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
