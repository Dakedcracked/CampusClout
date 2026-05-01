"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileStats from "@/components/profile/ProfileStats";
import RateUserModal from "@/components/profile/RateUserModal";
import EditProfileModal from "@/components/profile/EditProfileModal";
import PostCard, { Post } from "@/components/feed/PostCard";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface User {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  email: string;
  is_verified: boolean;
  created_at: string;
}

interface Balance {
  market_cap: number;
  wallet_balance: number;
  tokens_invested_in_me: number;
}

interface ProfileData {
  user: User;
  balance: Balance;
  follower_count: number;
  following_count: number;
  post_count: number;
  rating_score: number;
  rating_count: number;
  is_following: boolean;
  impressions_today: number;
}

type TabType = "posts" | "about" | "followers" | "following";

interface PageProps {
  params: Promise<{ username: string }>;
}

export default function ProfilePageComponent({ params: paramsPromise }: PageProps) {
  const router = useRouter();
  const [params, setParams] = useState<{ username: string } | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<{ username: string; display_name: string | null; avatar_url: string | null }[]>([]);
  const [following, setFollowing] = useState<{ username: string; display_name: string | null; avatar_url: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const isOwner = params ? currentUser?.username === params.username : false;

  useEffect(() => {
    paramsPromise.then(setParams);
  }, [paramsPromise]);

  useEffect(() => {
    if (params) {
      loadProfile();
      getCurrentUser();
    }
  }, [params?.username]);

  const loadProfile = async () => {
    if (!params) return;
    try {
      setLoading(true);
      const res = await fetch(
        `${API}/api/v1/profiles/${params.username}`,
        { credentials: "include" }
      );

      if (!res.ok) {
        if (res.status === 404) {
          router.push("/");
        }
        return;
      }

      const data = await res.json();
      setProfile(data);
      setIsFollowing(data.is_following);

      if (activeTab === "posts") {
        loadPosts();
      }
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUser = async () => {
    try {
      const res = await fetch(`${API}/api/v1/auth/me`, {
        credentials: "include",
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
      }
    } catch {
      // Not authenticated
    }
  };

  const loadPosts = async () => {
    if (!params) return;
    try {
      const res = await fetch(
        `${API}/api/v1/profile/${params.username}/posts?skip=0&limit=10`,
        { credentials: "include" }
      );
      if (res.ok) {
        setPosts(await res.json());
      }
    } catch {
      // Error loading posts
    }
  };

  const loadFollowers = async () => {
    if (!params) return;
    try {
      const res = await fetch(
        `${API}/api/v1/profile/${params.username}/followers`,
        { credentials: "include" }
      );
      if (res.ok) {
        setFollowers(await res.json());
      }
    } catch {
      // Error
    }
  };

  const loadFollowing = async () => {
    if (!params) return;
    try {
      const res = await fetch(
        `${API}/api/v1/profile/${params.username}/following`,
        { credentials: "include" }
      );
      if (res.ok) {
        setFollowing(await res.json());
      }
    } catch {
      // Error
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "followers" && followers.length === 0) {
      loadFollowers();
    }
    if (tab === "following" && following.length === 0) {
      loadFollowing();
    }
    if (tab === "posts" && posts.length === 0) {
      loadPosts();
    }
  };

  const handleFollow = async () => {
    if (!profile) return;

    try {
      const res = await fetch(
        `${API}/api/v1/profile/${profile.user.username}/follow`,
        {
          method: isFollowing ? "DELETE" : "POST",
          credentials: "include",
        }
      );

      if (res.ok) {
        setIsFollowing(!isFollowing);
        loadProfile();
      }
    } catch {
      // Error
    }
  };

  const handleRate = async (rating: number, note: string) => {
    if (!profile) return;

    try {
      const res = await fetch(`${API}/api/v1/profile/${profile.user.username}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, note: note || null }),
        credentials: "include",
      });

      if (res.ok) {
        loadProfile();
      }
    } catch {
      // Error
    }
  };

  const handleSaveProfile = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch(`${API}/api/v1/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (res.ok) {
        loadProfile();
        getCurrentUser();
      }
    } catch {
      // Error
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-32 h-32 rounded-full bg-border" />
        </div>
      </div>
    );
  }

  if (!profile || !params) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-text-muted">Profile not found</p>
      </div>
    );
  }

  const daysJoined = Math.floor(
    (Date.now() - new Date(profile.user.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background"
    >
      <div className="max-w-3xl mx-auto p-4 pt-20">
        {/* Header */}
        <ProfileHeader
          user={profile.user}
          balance={profile.balance}
          followerCount={profile.follower_count}
          ratingScore={profile.rating_score}
          ratingCount={profile.rating_count}
          coverImage={profile.user.cover_image_url}
          isOwner={isOwner}
          isFollowing={isFollowing}
          onEdit={() => setEditModalOpen(true)}
          onFollow={handleFollow}
          onMessage={() => router.push(`/chat/${profile.user.username}`)}
          onRate={() => setRateModalOpen(true)}
        />

        {/* Stats */}
        <ProfileStats
          postCount={profile.post_count}
          followerCount={profile.follower_count}
          followingCount={profile.following_count}
          marketCap={profile.balance.market_cap}
        />

        {/* Joined info */}
        <div className="text-sm text-text-muted mb-6">
          Joined {daysJoined} days ago
          {isOwner && (
            <span className="ml-4 text-text-secondary">
              {profile.impressions_today} profile views today
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-6 -mx-4 px-4">
          {["posts", "about", "followers", "following"].map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab as TabType)}
              className={cn(
                "px-4 py-3 font-medium text-sm transition-colors border-b-2 capitalize",
                activeTab === tab
                  ? "text-accent border-accent"
                  : "text-text-muted border-transparent hover:text-text-secondary"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === "posts" && (
            <>
              {posts.length > 0 ? (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={() => loadPosts()}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <p className="text-text-muted">No posts yet</p>
                </div>
              )}
            </>
          )}

          {activeTab === "about" && (
            <div className="glass-card p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-text-muted mb-2">
                  Bio
                </h3>
                <p className="text-text-primary">
                  {profile.user.bio || "No bio added"}
                </p>
              </div>
              {profile.user.email && (
                <div>
                  <h3 className="text-sm font-semibold text-text-muted mb-2">
                    Email
                  </h3>
                  <p className="text-text-primary">{profile.user.email}</p>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-text-muted mb-2">
                  University
                </h3>
                <p className="text-text-primary">
                  {profile.user.is_verified ? "✓ Verified" : "Unverified"}
                </p>
              </div>
            </div>
          )}

          {activeTab === "followers" && (
            <div className="space-y-2">
              {followers.length > 0 ? (
                followers.map((user) => (
                  <motion.div
                    key={user.username}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.avatar_url}
                          alt={user.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-clout/20 flex items-center justify-center text-sm font-bold text-clout">
                          {(user.username?.[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-text-primary">
                          {user.display_name}
                        </p>
                        <p className="text-xs text-text-muted">@{user.username}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/profile/${user.username}`)}
                      className="text-accent text-sm hover:underline"
                    >
                      View
                    </button>
                  </motion.div>
                ))
              ) : (
                <p className="text-center text-text-muted py-6">No followers yet</p>
              )}
            </div>
          )}

          {activeTab === "following" && (
            <div className="space-y-2">
              {following.length > 0 ? (
                following.map((user) => (
                  <motion.div
                    key={user.username}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.avatar_url}
                          alt={user.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent">
                          {(user.username?.[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-text-primary">
                          {user.display_name}
                        </p>
                        <p className="text-xs text-text-muted">@{user.username}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/profile/${user.username}`)}
                      className="text-accent text-sm hover:underline"
                    >
                      View
                    </button>
                  </motion.div>
                ))
              ) : (
                <p className="text-center text-text-muted py-6">Not following anyone yet</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <RateUserModal
        isOpen={rateModalOpen && !isOwner}
        onClose={() => setRateModalOpen(false)}
        username={profile.user.username}
        displayName={profile.user.display_name}
        onSubmit={handleRate}
      />

      <EditProfileModal
        isOpen={editModalOpen && isOwner}
        onClose={() => setEditModalOpen(false)}
        currentBio={profile.user.bio}
        currentAvatarUrl={profile.user.avatar_url}
        currentCoverUrl={profile.user.cover_image_url}
        onSave={handleSaveProfile}
      />
    </motion.div>
  );
}
