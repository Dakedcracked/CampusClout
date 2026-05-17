"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import PostCard from "../feed/PostCard";

interface User { id: string; username: string; display_name: string | null; bio: string | null; avatar_url: string | null; email: string; university_domain: string; is_verified: boolean; college_name?: string | null; major?: string | null; interests?: string[]; }
interface Balance { wallet_balance: number; tokens_invested_in_me: number; market_cap: number; beauty_coins?: number; }
interface Post { id: string; author_username: string; author_display_name: string | null; author_avatar_url: string | null; author_market_cap: number; content: string; like_count: number; comment_count: number; is_liked_by_me: boolean; rank_score: number; is_alter_ego_post: boolean; alter_ego_alias: string | null; media_url: string | null; media_type: string | null; created_at: string; }
interface FollowUser { username: string; display_name: string | null; avatar_url: string | null; follower_count: number; }

const COLORS = ["#9d4edd", "#f472b6", "#60a5fa", "#00e5a0", "#fbbf24", "#f97316"];
const bg = (n: string) => COLORS[n.charCodeAt(0) % COLORS.length];

function Avi({ src, name, size = 80 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} className="rounded-full object-cover flex-shrink-0 border-2 border-[#111] shadow-2xl" style={{ width: size, height: size }} />;
  return <div className="rounded-full flex items-center justify-center font-black text-white flex-shrink-0 border-2 border-[#111] shadow-2xl" style={{ width: size, height: size, background: `linear-gradient(135deg,${bg(name)},${bg(name)}99)`, fontSize: size * 0.38 }}>{name[0].toUpperCase()}</div>;
}

export default function ProfilePage({ user, balance, onUserUpdate, onMessageUser }: { user: User; balance: Balance | null; onUserUpdate: (u: Partial<User>) => void; onMessageUser?: (username: string) => void; }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [stats, setStats] = useState<{ hot_count: number; not_count: number; follower_count: number; following_count: number } | null>(null);
  const [tab, setTab] = useState<"posts" | "followers" | "following">("posts");
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? "");
  const [collegeName, setCollegeName] = useState(user.college_name ?? "");
  const [major, setMajor] = useState(user.major ?? "");
  const [interests, setInterests] = useState<string[]>(user.interests ?? []);
  const [interestInput, setInterestInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const trendingFileRef = useRef<HTMLInputElement>(null);
  const [trendingPics, setTrendingPics] = useState<string[]>([]);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/profiles/${user.username}?_t=${Date.now()}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null).then(d => {
        if (!d) return;
        if (d.posts) { setPosts(d.posts); }
        if (d.trending_pics) setTrendingPics(d.trending_pics);
        if (d.cover_image_url) setCoverPhoto(d.cover_image_url);
        setStats({ hot_count: d.hot_count ?? 0, not_count: d.not_count ?? 0, follower_count: d.follower_count ?? 0, following_count: d.following_count ?? 0 });
      }).catch(() => {});
  }, [user.username]);

  async function loadFollowers() { const r = await fetch(`/api/v1/profiles/${user.username}/followers`, { credentials: "include" }); if (r.ok) setFollowers(await r.json()); }
  async function loadFollowing() { const r = await fetch(`/api/v1/profiles/${user.username}/following`, { credentials: "include" }); if (r.ok) setFollowing(await r.json()); }

  function handleTabChange(t: "posts" | "followers" | "following") {
    setTab(t);
    if (t === "followers" && followers.length === 0) loadFollowers();
    if (t === "following" && following.length === 0) loadFollowing();
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    try { const fd = new FormData(); fd.append("file", file); const r = await fetch("/api/v1/upload/image", { method: "POST", credentials: "include", body: fd }); if (r.ok) { const d = await r.json(); setAvatarUrl(d.url); } } finally { setUploading(false); }
  }

  async function uploadTrendingPic(file: File) {
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/v1/upload/image", { method: "POST", credentials: "include", body: fd });
    if (r.ok) { const d = await r.json(); const newPics = [...trendingPics, d.url].slice(0, 6); setTrendingPics(newPics); await fetch("/api/v1/auth/me", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trending_pics: newPics }) }); }
  }

  async function saveProfile() {
    setSaving(true);
    try { const r = await fetch("/api/v1/auth/me", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: displayName.trim() || null, bio: bio.trim() || null, avatar_url: avatarUrl.trim() || null, college_name: collegeName.trim() || null, major: major.trim() || null, interests }) }); if (r.ok) { const d = await r.json(); onUserUpdate(d); setEditing(false); } } finally { setSaving(false); }
  }

  function shareProfile() { navigator.clipboard.writeText(window.location.href).catch(() => {}); setShareToast(true); setTimeout(() => setShareToast(false), 2000); }

  const hotPct = stats && (stats.hot_count + stats.not_count > 0) ? Math.round(stats.hot_count / (stats.hot_count + stats.not_count) * 100) : null;

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden font-sans pb-20">
      <AnimatePresence>
        {shareToast && <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#111] border border-[#333] text-white text-sm px-5 py-2.5 rounded-full shadow-xl">🔗 Profile Copied!</motion.div>}
      </AnimatePresence>

      {/* Premium Cover Photo Area */}
      <div className="relative w-full h-[280px] md:h-[360px] bg-gradient-to-br from-[#1a0b2e] via-[#0d0716] to-black">
        {coverPhoto && (
          <img src={coverPhoto} alt="Cover" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        
        {/* Top-Right Actions */}
        <div className="absolute top-4 right-4 flex gap-3 z-10">
          <button onClick={shareProfile} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition shadow-lg">
            ↗
          </button>
          <button onClick={() => setEditing(true)} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition shadow-lg">
            ✎
          </button>
        </div>
      </div>

      {/* Main Profile Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative -mt-24 z-10 flex flex-col md:flex-row md:items-end gap-6">
        <div className="relative inline-block">
          <div className="p-1.5 bg-black rounded-full shadow-[0_0_40px_rgba(157,78,221,0.3)]">
            <Avi src={avatarUrl || user.avatar_url} name={user.username} size={140} />
          </div>
          {user.is_verified && (
            <div className="absolute bottom-4 right-4 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-4 border-black shadow-lg">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-4 h-4"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
          )}
        </div>

        <div className="flex-1 pb-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">
            {user.display_name ?? user.username}
          </h1>
          <p className="text-[#888] font-medium text-lg mt-1">@{user.username}</p>
          {user.bio && <p className="mt-4 text-[#ccc] leading-relaxed max-w-2xl text-sm">{user.bio}</p>}
          
          {/* College and Major Info */}
          <div className="mt-4 flex flex-wrap gap-3">
            {user.college_name && (
              <span className="text-xs bg-blue-500/20 border border-blue-500/30 text-blue-200 px-3 py-1.5 rounded-lg font-medium">
                🎓 {user.college_name}
              </span>
            )}
            {user.major && (
              <span className="text-xs bg-purple-500/20 border border-purple-500/30 text-purple-200 px-3 py-1.5 rounded-lg font-medium">
                📚 {user.major}
              </span>
            )}
          </div>
          
          {/* Interests Display */}
          {user.interests && user.interests.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {user.interests.map((interest, i) => (
                <span key={i} className="text-xs bg-violet-500/20 border border-violet-500/30 text-violet-200 px-3 py-1.5 rounded-lg">
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Stats Summary Grid */}
        <div className="flex flex-wrap justify-center md:justify-end gap-3 md:gap-4 md:pb-4 self-start md:self-end">
          <div className="glass-card px-5 py-3 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl text-center shadow-lg">
            <p className="text-[10px] uppercase font-bold text-violet-400 tracking-wider">Followers</p>
            <p className="text-xl font-black text-white">{stats?.follower_count ?? 0}</p>
          </div>
          <div className="glass-card px-5 py-3 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl text-center shadow-lg">
            <p className="text-[10px] uppercase font-bold text-violet-400 tracking-wider">Following</p>
            <p className="text-xl font-black text-white">{stats?.following_count ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Metrics & Trending */}
        <div className="md:col-span-1 space-y-6">
          {/* Economy Box */}
          <div className="glass-card p-6 rounded-3xl border border-white/5 bg-gradient-to-b from-[#111] to-black shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="text-yellow-500">◈</span> Clout Economy
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-[#888] font-medium mb-1">Market Cap</p>
                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                  {balance?.market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? 0}
                </p>
              </div>
              <div className="h-[1px] bg-white/10" />
              <div>
                <p className="text-[11px] text-[#888] font-medium mb-1">Wallet Balance</p>
                <p className="text-xl font-bold text-white">{balance?.wallet_balance.toLocaleString() ?? 0} ◈</p>
              </div>
            </div>
          </div>

          {/* Beauty/Attractiveness Box */}
          {hotPct !== null && (
            <div className="glass-card p-6 rounded-3xl border border-pink-500/20 bg-gradient-to-br from-[#1a0a14] to-black shadow-xl relative overflow-hidden">
              <div className="absolute -right-6 -top-6 text-6xl opacity-10">🔥</div>
              <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Attractiveness</h3>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-pink-500">{hotPct}%</span>
                <span className="text-sm text-[#888] mb-1 font-medium">Hot Rating</span>
              </div>
              <div className="mt-4 h-2 rounded-full bg-[#222] overflow-hidden flex">
                <motion.div initial={{ width: 0 }} animate={{ width: `${hotPct}%` }} className="bg-gradient-to-r from-pink-600 to-red-500" />
                <motion.div initial={{ width: 0 }} animate={{ width: `${100 - hotPct}%` }} className="bg-[#333]" />
              </div>
            </div>
          )}

          {/* Photo Gallery (Trending Pics) */}
          <div className="glass-card p-6 rounded-3xl border border-white/5 bg-[#111]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Gallery</h3>
              {editing && (
                <label className="text-[10px] bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-full cursor-pointer text-white font-bold transition">
                  + Add
                  <input type="file" ref={trendingFileRef} className="hidden" accept="image/*" onChange={e => { if (e.target.files?.[0]) uploadTrendingPic(e.target.files[0]); }} />
                </label>
              )}
            </div>
            {trendingPics.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {trendingPics.map((pic, i) => (
                  <motion.div key={i} whileHover={{ scale: 1.05 }} className="aspect-square rounded-xl overflow-hidden bg-[#222] border border-[#333]">
                    <img src={pic} className="w-full h-full object-cover" alt="" />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="aspect-square rounded-xl bg-[#1a1a1a] border border-dashed border-[#333] flex flex-col items-center justify-center text-center p-4">
                <span className="text-2xl mb-2 opacity-50">📸</span>
                <p className="text-[10px] text-[#666]">No photos yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Feed & Content */}
        <div className="md:col-span-2">
          {/* Custom Tabs */}
          <div className="flex gap-1 bg-[#161616] p-1.5 rounded-2xl mb-6">
            {(["posts", "followers", "following"] as const).map(t => (
              <button key={t} onClick={() => handleTabChange(t)}
                className={`flex-1 py-2.5 text-xs font-bold capitalize rounded-xl transition-all duration-300 ${tab === t ? "bg-[#2a2a2a] text-white shadow-lg" : "text-[#666] hover:text-[#999]"}`}>
                {t} {t === "followers" ? `(${stats?.follower_count ?? 0})` : t === "following" ? `(${stats?.following_count ?? 0})` : ""}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {tab === "posts" && (
                <div className="space-y-4">
                  {posts.length === 0 ? (
                    <div className="text-center py-20 bg-[#111] rounded-3xl border border-white/5">
                      <div className="text-4xl mb-3 opacity-30">📭</div>
                      <p className="text-[#888] font-medium">No posts yet.</p>
                    </div>
                  ) : (
                    posts.map(p => (
                      <div key={p.id} className="bg-[#111] border border-white/5 rounded-3xl overflow-hidden">
                        <PostCard post={p} currentUsername={user.username} />
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === "followers" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {followers.map(f => (
                    <Link key={f.username} href={`/profile/${f.username}`} className="flex items-center gap-3 p-4 bg-[#111] border border-white/5 hover:border-violet-500/30 rounded-2xl transition">
                      <Avi src={f.avatar_url} name={f.username} size={44} />
                      <div>
                        <p className="font-bold text-white text-sm">{f.display_name ?? f.username}</p>
                        <p className="text-[11px] text-[#888]">@{f.username}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {tab === "following" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {following.map(f => (
                    <Link key={f.username} href={`/profile/${f.username}`} className="flex items-center gap-3 p-4 bg-[#111] border border-white/5 hover:border-violet-500/30 rounded-2xl transition">
                      <Avi src={f.avatar_url} name={f.username} size={44} />
                      <div>
                        <p className="font-bold text-white text-sm">{f.display_name ?? f.username}</p>
                        <p className="text-[11px] text-[#888]">@{f.username}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#111] border border-[#222] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6">
              <h2 className="text-2xl font-black text-white mb-6">Edit Profile</h2>
              
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="relative group">
                  <Avi src={avatarUrl || user.avatar_url} name={user.username} size={96} />
                  <label className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <span className="text-xs font-bold text-white">{uploading ? "..." : "Change"}</span>
                    <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={e => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0]); }} disabled={uploading} />
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Display Name</label>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors" placeholder="Your Name" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Bio</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors resize-none" rows={3} placeholder="Write something about yourself..." />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-wider mb-1.5">College/University</label>
                  <input value={collegeName} onChange={e => setCollegeName(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors" placeholder="e.g., Stanford University" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Major/Field of Study</label>
                  <input value={major} onChange={e => setMajor(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors" placeholder="e.g., Computer Science" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Interests</label>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {interests.map((interest, i) => (
                      <button key={i} onClick={() => setInterests(interests.filter((_, idx) => idx !== i))} className="px-3 py-1.5 bg-violet-600/30 text-violet-200 text-xs rounded-lg hover:bg-violet-600/50 transition-colors border border-violet-500/30">
                        {interest} ✕
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={interestInput} onChange={e => setInterestInput(e.target.value)} onKeyPress={e => { if (e.key === "Enter" && interestInput.trim()) { setInterests([...interests, interestInput.trim()]); setInterestInput(""); } }} className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors" placeholder="Add interest (press Enter)" />
                    <button onClick={() => { if (interestInput.trim()) { setInterests([...interests, interestInput.trim()]); setInterestInput(""); } }} className="px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl text-sm transition-colors">Add</button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setEditing(false)} className="flex-1 py-3.5 bg-[#222] hover:bg-[#333] text-white font-bold rounded-xl text-sm transition-colors">Cancel</button>
                <button onClick={saveProfile} disabled={saving} className="flex-1 py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-purple-500/20 disabled:opacity-50">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
