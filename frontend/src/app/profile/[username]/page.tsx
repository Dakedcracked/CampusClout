"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProfileViewTracker } from "@/hooks/useBehaviorTracker";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProfileData {
  user_id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_image_url?: string | null;
  trending_pics?: string[];
  university_domain: string;
  is_verified: boolean;
  market_cap: number;
  wallet_balance: number;
  tokens_invested_in_me: number;
  hot_count: number;
  not_count: number;
  vote_score: number;
  viewer_vote?: "hot" | "not" | null;
  beauty_score?: number | null;
  follower_count: number;
  following_count: number;
  post_count: number;
  rating_score?: number;
  rating_count?: number;
  is_following?: boolean;
  joined?: string;
  posts?: PostItem[];
}

interface PostItem {
  id: string;
  content: string;
  like_count: number;
  comment_count: number;
  media_url?: string | null;
  media_type?: string | null;
  created_at: string;
}

interface FollowUser {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count?: number;
}

type Tab = "posts" | "about" | "followers" | "following";

interface PageProps {
  params: Promise<{ username: string }>;
}

const COLORS = ["#9d4edd","#f472b6","#60a5fa","#00e5a0","#fbbf24","#f97316","#22d3ee"];
function avatarBg(name: string) { return COLORS[name.charCodeAt(0) % COLORS.length]; }

function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />;
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${avatarBg(name)}, ${avatarBg(name)}99)`, fontSize: size * 0.4 }}>
      {name[0].toUpperCase()}
    </div>
  );
}

function StatNum({ n }: { n: number }) {
  if (n >= 1_000_000) return <>{(n / 1_000_000).toFixed(1)}M</>;
  if (n >= 1_000) return <>{(n / 1_000).toFixed(1)}K</>;
  return <>{n}</>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProfilePageComponent({ params: paramsPromise }: PageProps) {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);

  // AI profiling: measure dwell time on this profile
  useProfileViewTracker(username ?? undefined);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("posts");
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);
  const [postLikes, setPostLikes] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  const isOwner = myUsername === username;

  useEffect(() => { paramsPromise.then((p) => setUsername(p.username)); }, [paramsPromise]);

  useEffect(() => {
    if (!username) return;
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  async function loadAll() {
    setLoading(true);
    try {
      const [profileRes, meRes] = await Promise.all([
        fetch(`/api/v1/profiles/${username}`, { credentials: "include" }),
        fetch("/api/v1/auth/me", { credentials: "include" }),
      ]);
      if (!profileRes.ok) { router.push("/dashboard"); return; }
      const data: ProfileData = await profileRes.json();
      setProfile(data);
      setIsFollowing(data.is_following ?? false);
      if (data.posts) {
        setPosts(data.posts);
        const likes: Record<string, { liked: boolean; count: number }> = {};
        data.posts.forEach((p) => { likes[p.id] = { liked: false, count: p.like_count }; });
        setPostLikes(likes);
      }
      if (meRes.ok) { const me = await meRes.json(); setMyUsername(me.username); }
    } finally {
      setLoading(false);
    }
  }

  async function loadFollowers() {
    const res = await fetch(`/api/v1/profiles/${username}/followers`, { credentials: "include" });
    if (res.ok) setFollowers(await res.json());
  }

  async function loadFollowing() {
    const res = await fetch(`/api/v1/profiles/${username}/following`, { credentials: "include" });
    if (res.ok) setFollowing(await res.json());
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === "followers" && followers.length === 0) loadFollowers();
    if (tab === "following" && following.length === 0) loadFollowing();
  }

  async function handleFollow() {
    if (!profile || followLoading) return;
    setFollowLoading(true);
    try {
      const res = await fetch(`/api/v1/profiles/${username}/follow`, { method: "POST", credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.is_following);
        setProfile((p) => p ? { ...p, follower_count: p.follower_count + (data.is_following ? 1 : -1) } : p);
      }
    } finally { setFollowLoading(false); }
  }

  async function handleLikePost(postId: string) {
    const current = postLikes[postId] ?? { liked: false, count: 0 };
    setPostLikes((prev) => ({ ...prev, [postId]: { liked: !current.liked, count: current.liked ? current.count - 1 : current.count + 1 } }));
    await fetch(`/api/v1/feed/${postId}/like`, { method: "POST", credentials: "include" });
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  }

  async function saveProfile() {
    setEditSaving(true);
    try {
      const res = await fetch("/api/v1/auth/me", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: editName, bio: editBio }),
      });
      if (res.ok) { setEditOpen(false); loadAll(); }
    } finally { setEditSaving(false); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-[#9d4edd] border-t-transparent animate-spin" />
    </div>
  );

  if (!profile || !username) return (
    <div className="min-h-screen flex items-center justify-center text-[#555]">Profile not found</div>
  );

  const daysJoined = profile.joined
    ? Math.floor((Date.now() - new Date(profile.joined).getTime()) / 86400000)
    : null;

  const hotPct = profile.hot_count + profile.not_count > 0
    ? Math.round((profile.hot_count / (profile.hot_count + profile.not_count)) * 100)
    : 50;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Share Toast */}
      <AnimatePresence>
        {shareToast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#111] border border-[#333] text-white text-sm px-5 py-2.5 rounded-full shadow-xl">
            🔗 Link copied!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post Detail Modal */}
      <AnimatePresence>
        {selectedPost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedPost(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-[#111] border border-[#222] rounded-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              {/* Post header */}
              <div className="flex items-center gap-3 p-4 border-b border-[#1a1a1a]">
                <Avatar src={profile.avatar_url} name={profile.username} size={36} />
                <div>
                  <p className="font-semibold text-white text-sm">{profile.display_name ?? profile.username}</p>
                  <p className="text-xs text-[#555]">@{profile.username}</p>
                </div>
                <button onClick={() => setSelectedPost(null)} className="ml-auto text-[#555] hover:text-white text-xl">✕</button>
              </div>
              {/* Media */}
              {selectedPost.media_url && selectedPost.media_type === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedPost.media_url} alt="" className="w-full max-h-[400px] object-cover" />
              )}
              {/* Content */}
              <div className="p-4">
                <p className="text-[15px] text-[#ddd] leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-4 px-4 pb-4 border-t border-[#1a1a1a] pt-3">
                <button onClick={() => handleLikePost(selectedPost.id)}
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${(postLikes[selectedPost.id]?.liked) ? "text-pink-400" : "text-[#777] hover:text-pink-400"}`}>
                  {postLikes[selectedPost.id]?.liked ? "❤️" : "🤍"} {postLikes[selectedPost.id]?.count ?? selectedPost.like_count}
                </button>
                <span className="text-[#555] text-sm">💬 {selectedPost.comment_count}</span>
                <button onClick={handleShare} className="ml-auto text-[#555] hover:text-white text-sm">🔗 Share</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditOpen(false)}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              className="bg-[#111] border border-[#222] rounded-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-white mb-4">Edit Profile</h2>
              <label className="block text-xs text-[#777] mb-1">Display Name</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] text-white rounded-xl px-4 py-2.5 mb-4 focus:outline-none focus:border-[#9d4edd] transition-colors" />
              <label className="block text-xs text-[#777] mb-1">Bio</label>
              <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={4}
                className="w-full bg-[#1a1a1a] border border-[#333] text-white rounded-xl px-4 py-2.5 mb-5 resize-none focus:outline-none focus:border-[#9d4edd] transition-colors" />
              <div className="flex gap-3">
                <button onClick={() => setEditOpen(false)} className="flex-1 py-2.5 rounded-xl border border-[#333] text-[#777] hover:text-white transition-colors">Cancel</button>
                <button onClick={saveProfile} disabled={editSaving}
                  className="flex-1 py-2.5 rounded-xl bg-[#9d4edd] text-white font-semibold hover:bg-[#a855f7] transition-colors disabled:opacity-50">
                  {editSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[935px] mx-auto px-4 py-8 md:pt-12">

        {/* ── Profile Header ── */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 mb-10">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="p-0.5 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
              <div className="p-0.5 bg-[#0a0a0a] rounded-full">
                <Avatar src={profile.avatar_url} name={profile.username} size={96} />
              </div>
            </div>
            {profile.is_verified && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#9d4edd] flex items-center justify-center border-2 border-[#0a0a0a] text-white text-xs">✓</div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 mb-3">
              <h1 className="text-xl font-light text-white">{profile.username}</h1>
              {isOwner ? (
                <button onClick={() => { setEditName(profile.display_name ?? ""); setEditBio(profile.bio ?? ""); setEditOpen(true); }}
                  className="px-5 py-1.5 border border-[#333] rounded-lg text-sm font-semibold text-white hover:bg-[#1a1a1a] transition-colors">
                  Edit Profile
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button onClick={handleFollow} disabled={followLoading}
                    className={`px-6 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isFollowing ? "border border-[#333] text-white hover:bg-[#1a1a1a]" : "bg-[#9d4edd] text-white hover:bg-[#a855f7]"} disabled:opacity-50`}>
                    {followLoading ? "…" : isFollowing ? "Following" : "Follow"}
                  </button>
                  <Link href={`/dashboard?activeTab=chat`} onClick={() => {}}
                    className="px-4 py-1.5 border border-[#333] rounded-lg text-sm font-semibold text-white hover:bg-[#1a1a1a] transition-colors">
                    Message
                  </Link>
                </div>
              )}
              <button onClick={handleShare} className="p-2 rounded-lg border border-[#333] hover:bg-[#1a1a1a] transition-colors text-white" title="Share Profile">
                🔗
              </button>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-4 sm:gap-6 mb-4">
              {[
                { label: "posts", value: profile.post_count },
                { label: "followers", value: profile.follower_count, onClick: () => handleTabChange("followers") },
                { label: "following", value: profile.following_count, onClick: () => handleTabChange("following") },
              ].map(({ label, value, onClick }) => (
                <button key={label} onClick={onClick}
                  className="min-w-[90px] text-center flex flex-col items-center sm:flex-row sm:gap-1.5 group">
                  <span className="font-bold text-white group-hover:underline"><StatNum n={value} /></span>
                  <span className="text-xs sm:text-sm text-[#aaa]">{label}</span>
                </button>
              ))}
            </div>

            {/* Bio & meta */}
            {profile.display_name && <p className="font-semibold text-white mb-1">{profile.display_name}</p>}
            {profile.bio && <p className="text-sm text-[#ccc] leading-relaxed mb-2 max-w-sm">{profile.bio}</p>}
            <p className="text-xs text-[#555]">🎓 {profile.university_domain}</p>
            {daysJoined !== null && <p className="text-xs text-[#555] mt-0.5">📅 Joined {daysJoined} days ago</p>}

            {/* Market Cap & Hot bar */}
            <div className="flex items-center gap-4 mt-3 flex-wrap justify-center sm:justify-start">
              <span className="text-xs font-mono font-bold text-[#a78bfa] bg-[#a78bfa]/10 px-2 py-1 rounded-full">◈ {profile.market_cap.toLocaleString()}</span>
              <span className="text-xs font-mono font-bold text-[#f09433] bg-[#f09433]/10 px-2 py-1 rounded-full">🔥 {hotPct}% Hot</span>
              {profile.beauty_score && (
                <span className="text-xs font-mono font-bold text-[#f472b6] bg-[#f472b6]/10 px-2 py-1 rounded-full">✨ {profile.beauty_score.toFixed(1)}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Trending Pics strip ── */}
        {profile.trending_pics && profile.trending_pics.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
            {profile.trending_pics.map((pic, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={pic} alt="" className="w-24 h-24 rounded-xl object-cover flex-shrink-0 border border-[#222] hover:opacity-80 transition-opacity cursor-pointer" />
            ))}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex border-t border-[#1a1a1a] mb-6">
          {([
            { id: "posts", icon: "⊞", label: "POSTS" },
            { id: "followers", icon: "👥", label: "FOLLOWERS" },
            { id: "following", icon: "👤", label: "FOLLOWING" },
            { id: "about", icon: "ℹ️", label: "ABOUT" },
          ] as { id: Tab; icon: string; label: string }[]).map((tab) => (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
              className={`flex-1 py-3 text-xs font-semibold tracking-widest transition-colors flex items-center justify-center gap-2 border-t-2 -mt-[1px] ${
                activeTab === tab.id ? "text-white border-white" : "text-[#555] border-transparent hover:text-[#888]"
              }`}>
              <span className="hidden sm:block">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

            {/* Posts Grid */}
            {activeTab === "posts" && (
              <div className="grid grid-cols-3 gap-0.5 md:gap-1">
                {posts.length > 0 ? posts.map((post) => (
                  <div key={post.id} onClick={() => setSelectedPost(post)}
                    className="aspect-square relative group cursor-pointer bg-[#111] overflow-hidden">
                    {post.media_url && post.media_type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full p-3 flex items-center justify-center text-center text-xs text-[#ccc] break-words">
                        <span className="line-clamp-4">{post.content}</span>
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-5 text-white pointer-events-none">
                      <span className="flex items-center gap-1 font-bold text-sm">❤️ {postLikes[post.id]?.count ?? post.like_count}</span>
                      <span className="flex items-center gap-1 font-bold text-sm">💬 {post.comment_count}</span>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-3 flex flex-col items-center justify-center py-24 gap-3">
                    <div className="w-16 h-16 rounded-full border-2 border-[#333] flex items-center justify-center text-3xl">📷</div>
                    <p className="font-bold text-white text-xl">No Posts Yet</p>
                    {isOwner && <p className="text-sm text-[#555]">Share your first photo or thought!</p>}
                  </div>
                )}
              </div>
            )}

            {/* Followers */}
            {activeTab === "followers" && (
              <div className="space-y-2 max-w-lg mx-auto">
                {followers.length > 0 ? followers.map((u) => (
                  <Link key={u.username} href={`/profile/${u.username}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#111] transition-colors group">
                    <Avatar src={u.avatar_url} name={u.username} size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate group-hover:underline">{u.display_name ?? u.username}</p>
                      <p className="text-xs text-[#555]">@{u.username}</p>
                    </div>
                    <span className="text-[#555] text-xs">→</span>
                  </Link>
                )) : <p className="text-center text-[#555] py-12">No followers yet</p>}
              </div>
            )}

            {/* Following */}
            {activeTab === "following" && (
              <div className="space-y-2 max-w-lg mx-auto">
                {following.length > 0 ? following.map((u) => (
                  <Link key={u.username} href={`/profile/${u.username}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#111] transition-colors group">
                    <Avatar src={u.avatar_url} name={u.username} size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate group-hover:underline">{u.display_name ?? u.username}</p>
                      <p className="text-xs text-[#555]">@{u.username}</p>
                    </div>
                    <span className="text-[#555] text-xs">→</span>
                  </Link>
                )) : <p className="text-center text-[#555] py-12">Not following anyone yet</p>}
              </div>
            )}

            {/* About */}
            {activeTab === "about" && (
              <div className="max-w-lg mx-auto space-y-4">
                {[
                  { label: "Display Name", value: profile.display_name },
                  { label: "Bio", value: profile.bio },
                  { label: "University", value: profile.university_domain },
                  { label: "Verification", value: profile.is_verified ? "✅ Verified Student" : "⏳ Unverified" },
                  { label: "Hot Score", value: `🔥 ${hotPct}% (${profile.hot_count} hot / ${profile.not_count} not)` },
                  { label: "Market Cap", value: `◈ ${profile.market_cap.toLocaleString()}` },
                  { label: "Member Since", value: daysJoined !== null ? `${daysJoined} days ago` : "—" },
                ].filter((r) => r.value).map(({ label, value }) => (
                  <div key={label} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
                    <p className="text-xs text-[#555] mb-1">{label}</p>
                    <p className="text-white text-sm">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
