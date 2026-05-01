"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface User {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  email: string;
  university_domain: string;
  is_verified: boolean;
}

interface Balance {
  wallet_balance: number;
  tokens_invested_in_me: number;
  market_cap: number;
  beauty_coins?: number;
}

interface Post {
  id: string;
  content: string;
  like_count: number;
  comment_count: number;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
}

interface FollowUser {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
}

function Avatar({ user, size = 80 }: { user: User; size?: number }) {
  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatar_url} alt={user.username}
        className="rounded-full object-cover avatar-ring flex-shrink-0"
        style={{ width: size, height: size }} />
    );
  }
  const colors = ["#9d4edd", "#f472b6", "#60a5fa", "#00e5a0", "#fbbf24"];
  const bg = colors[user.username.charCodeAt(0) % colors.length];
  return (
    <div className="rounded-full flex items-center justify-center font-black text-white flex-shrink-0 avatar-ring"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${bg}, ${bg}99)`, fontSize: size * 0.38 }}>
      {((user.display_name ?? user.username)?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

function SmallAvatar({ u }: { u: FollowUser }) {
  if (u.avatar_url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={u.avatar_url} alt={u.username} className="w-10 h-10 rounded-full object-cover" />
  );
  const colors = ["#9d4edd", "#f472b6", "#60a5fa", "#00e5a0", "#fbbf24"];
  const bg = colors[u.username.charCodeAt(0) % colors.length];
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
      style={{ background: `linear-gradient(135deg, ${bg}, ${bg}99)` }}>
      {((u.display_name ?? u.username)?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

export default function ProfilePage({
  user,
  balance,
  onUserUpdate,
}: {
  user: User;
  balance: Balance | null;
  onUserUpdate: (u: Partial<User>) => void;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [trendingData, setTrendingData] = useState<{ hot_count: number; not_count: number; follower_count: number; following_count: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load profile posts
    fetch(`/api/v1/profiles/${user.username}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.posts) setPosts(d.posts.slice(0, 12));
        setTrendingData({ hot_count: d.hot_count ?? 0, not_count: d.not_count ?? 0, follower_count: d.follower_count ?? 0, following_count: d.following_count ?? 0 });
      }).catch(() => {});
  }, [user.username]);

  async function loadFollowers() {
    const r = await fetch(`/api/v1/profiles/${user.username}/followers`, { credentials: "include" });
    if (r.ok) setFollowers(await r.json());
    setShowFollowers(true);
  }

  async function loadFollowing() {
    const r = await fetch(`/api/v1/profiles/${user.username}/following`, { credentials: "include" });
    if (r.ok) setFollowing(await r.json());
    setShowFollowing(true);
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/v1/upload/image", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (r.ok) {
        const d = await r.json();
        const url = d.url;
        setAvatarUrl(url);
      }
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setSaveError(null);
    try {
      const r = await fetch("/api/v1/auth/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        onUserUpdate(d);
        setEditing(false);
      } else {
        const d = await r.json();
        setSaveError(d.detail ?? "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  const hotPct = trendingData && (trendingData.hot_count + trendingData.not_count > 0)
    ? Math.round(trendingData.hot_count / (trendingData.hot_count + trendingData.not_count) * 100)
    : null;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Profile card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card-glow p-6">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <Avatar user={{ ...user, display_name: displayName || user.display_name, avatar_url: avatarUrl || user.avatar_url }} size={96} />
            {editing && (
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 rounded-full flex items-center justify-center bg-black/60 text-white text-xs font-semibold opacity-0 hover:opacity-100 transition-opacity"
                >
                  {uploading ? "…" : "📷"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
              </>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex flex-col gap-3">
                <input value={displayName} onChange={e => setDisplayName(e.target.value.slice(0, 64))}
                  placeholder="Display name" className="input-field text-lg font-bold" />
                <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 500))}
                  placeholder="Tell the campus about yourself…" rows={3} className="input-field resize-none text-sm" />
                <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)}
                  placeholder="Avatar URL (or upload above)" className="input-field text-sm" />
                {saveError && <p className="text-danger text-xs">{saveError}</p>}
                <div className="flex gap-2">
                  <button onClick={saveProfile} disabled={saving} className="btn-primary text-sm">
                    {saving ? "Saving…" : "Save Profile"}
                  </button>
                  <button onClick={() => { setEditing(false); setSaveError(null); setDisplayName(user.display_name ?? ""); setBio(user.bio ?? ""); setAvatarUrl(user.avatar_url ?? ""); }} className="btn-secondary text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-black text-text-primary">
                    {user.display_name ?? user.username}
                  </h1>
                  {user.is_verified && <span className="neon-badge text-xs">✓ verified</span>}
                </div>
                <p className="text-text-muted text-sm">@{user.username} · {user.university_domain}</p>
                {user.bio && <p className="text-text-secondary text-sm mt-2 leading-relaxed max-w-md">{user.bio}</p>}
                <button onClick={() => setEditing(true)} className="mt-3 btn-secondary text-xs">
                  Edit Profile
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="neon-divider my-5" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          {[
            { label: "Market Cap", value: balance?.market_cap.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "0", color: "text-clout" },
            { label: "Wallet", value: `◈ ${balance?.wallet_balance.toLocaleString() ?? "0"}`, color: "text-accent" },
            { label: "Beauty Coins", value: `💎 ${balance?.beauty_coins ?? 0}`, color: "text-neon-pink" },
            { label: "🔥 Hot", value: `${trendingData?.hot_count ?? 0}`, color: "text-orange-400" },
            {
              label: "Followers",
              value: `${trendingData?.follower_count ?? 0}`,
              color: "text-neon-blue",
              onClick: loadFollowers,
            },
            {
              label: "Following",
              value: `${trendingData?.following_count ?? 0}`,
              color: "text-neon-cyan",
              onClick: loadFollowing,
            },
          ].map((s) => (
            <button
              key={s.label}
              onClick={s.onClick}
              disabled={!s.onClick}
              className={`text-center rounded-xl p-3 transition-all ${s.onClick ? "hover:bg-surface-raised cursor-pointer" : "cursor-default"}`}
            >
              <div className={`text-xl font-black font-mono ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-text-muted mt-0.5 uppercase tracking-wide">{s.label}</div>
            </button>
          ))}
        </div>

        {/* Hot/Not bar */}
        {hotPct !== null && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-text-muted">Community Rating</span>
            <div className="flex-1 h-2 bg-surface-raised rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${hotPct}%`, background: "linear-gradient(90deg, #f472b6, #fb923c)" }} />
            </div>
            <span className="text-xs font-mono text-orange-400">{hotPct}% 🔥</span>
          </div>
        )}
      </motion.div>

      {/* Posts grid */}
      <div>
        <h2 className="font-bold text-lg mb-3 gradient-text">My Posts</h2>
        {posts.length === 0 ? (
          <div className="glass-card p-10 text-center text-text-muted">
            <p className="text-3xl mb-2">📝</p>
            <p>No posts yet. Share something with the campus!</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {posts.map((p) => (
              <div key={p.id} className="glass-card p-4">
                {p.media_url && p.media_type === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.media_url} alt="" className="rounded-lg w-full max-h-60 object-cover mb-3"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <p className="text-sm text-text-primary leading-relaxed">{p.content}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                  <span>♥ {p.like_count}</span>
                  <span>💬 {p.comment_count}</span>
                  <span className="ml-auto">{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Followers modal */}
      <AnimatePresence>
        {showFollowers && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowFollowers(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card-glow p-6 max-w-sm w-full max-h-[70vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold gradient-text">Followers ({followers.length})</h3>
                <button onClick={() => setShowFollowers(false)} className="text-text-muted hover:text-text-primary">✕</button>
              </div>
              {followers.length === 0 ? <p className="text-text-muted text-sm text-center py-6">No followers yet.</p> : (
                <div className="flex flex-col gap-3">
                  {followers.map(u => (
                    <div key={u.username} className="flex items-center gap-3">
                      <SmallAvatar u={u} />
                      <div>
                        <p className="font-semibold text-sm">{u.display_name ?? u.username}</p>
                        <p className="text-text-muted text-xs">@{u.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Following modal */}
      <AnimatePresence>
        {showFollowing && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowFollowing(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card-glow p-6 max-w-sm w-full max-h-[70vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold gradient-text">Following ({following.length})</h3>
                <button onClick={() => setShowFollowing(false)} className="text-text-muted hover:text-text-primary">✕</button>
              </div>
              {following.length === 0 ? <p className="text-text-muted text-sm text-center py-6">Not following anyone yet.</p> : (
                <div className="flex flex-col gap-3">
                  {following.map(u => (
                    <div key={u.username} className="flex items-center gap-3">
                      <SmallAvatar u={u} />
                      <div>
                        <p className="font-semibold text-sm">{u.display_name ?? u.username}</p>
                        <p className="text-text-muted text-xs">@{u.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
