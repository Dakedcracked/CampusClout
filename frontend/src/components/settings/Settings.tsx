"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";

interface User {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  email: string;
  university_domain: string;
  is_verified: boolean;
  trending_pics?: string[];
}

export default function Settings({
  user,
  onUserUpdate,
  onLogout,
}: {
  user: User;
  onUserUpdate: (u: Partial<User>) => void;
  onLogout: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? "");
  const [trendingPics, setTrendingPics] = useState<string[]>(user.trending_pics ?? []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // New features state
  const [activeTab, setActiveTab] = useState("Profile");
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowMessages, setAllowMessages] = useState("everyone");
  const [notifyLikes, setNotifyLikes] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [aiPersona, setAiPersona] = useState("lover");
  
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPEG, PNG, or WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10 MB.");
      return;
    }
    setUploading(true);
    setError(null);
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
        setAvatarUrl(d.url);
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.detail ?? "Upload failed. Try again.");
      }
    } catch {
      setError("Network error during upload.");
    } finally {
      setUploading(false);
    }
  }

  async function uploadTrendingPic(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (trendingPics.length >= 5) {
      setError("Maximum 5 trending pictures allowed.");
      return;
    }
    setUploading(true);
    setError(null);
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
        setTrendingPics([...trendingPics, d.url]);
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.detail ?? "Upload failed.");
      }
    } catch {
      setError("Network error during upload.");
    } finally {
      setUploading(false);
    }
  }

  function removeTrendingPic(index: number) {
    setTrendingPics(trendingPics.filter((_, i) => i !== index));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const r = await fetch("/api/v1/auth/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
          trending_pics: trendingPics,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        onUserUpdate(d);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const d = await r.json();
        setError(d.detail ?? "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  const colors = ["#9d4edd", "#f472b6", "#60a5fa", "#00e5a0", "#fbbf24"];
  const avatarBg = colors[user.username.charCodeAt(0) % colors.length];

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card-glow p-6">
        <h2 className="text-xl font-black gradient-text mb-1">Settings</h2>
        <p className="text-text-muted text-sm mb-6">Manage your profile and account</p>

        {/* Tabs */}
        <div className="flex border-b border-border mb-6 overflow-x-auto scrollbar-hide">
          {["Profile", "Privacy", "Notifications", "AI Preferences"].map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-3 text-[15px] font-semibold transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-text-primary text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <form onSubmit={save} className="flex flex-col gap-6">
          {activeTab === "Profile" && (
            <>
              {/* Account info (read-only) */}
              <div className="flex flex-col gap-3 p-4 rounded-xl bg-surface-raised border border-border">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">Account</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-text-muted mb-1">Username</p>
                    <p className="text-sm font-semibold text-text-primary font-mono">@{user.username}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-1">Email</p>
                    <p className="text-sm text-text-secondary truncate">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-1">University</p>
                    <p className="text-sm text-text-secondary">{user.university_domain}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-1">Status</p>
                    <p className={`text-sm font-semibold ${user.is_verified ? "text-blue-400" : "text-warning"}`}>
                      {user.is_verified ? "✓ Verified" : "⚠ Unverified"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Profile fields */}
              <div className="flex flex-col gap-5">
                {/* Avatar upload */}
                <div>
                  <label className="text-[13px] font-semibold text-text-primary mb-3 block">Profile Photo</label>
                  <div className="flex items-center gap-5">
                    {/* Current avatar preview */}
                    <div className="relative flex-shrink-0">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt="avatar"
                          className="w-20 h-20 rounded-full object-cover border border-border"
                          onError={e => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div
                          className="w-20 h-20 rounded-full flex items-center justify-center font-black text-white text-3xl border border-border"
                          style={{ background: `linear-gradient(135deg, ${avatarBg}, ${avatarBg}99)` }}
                        >
                          {((user.display_name ?? user.username)?.[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                      {uploading && (
                        <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="btn-secondary text-[14px] disabled:opacity-50 w-fit px-6"
                      >
                        {uploading ? "Uploading…" : "Change Photo"}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) uploadAvatar(f);
                        }}
                      />
                      <p className="text-[12px] text-text-muted">JPEG, PNG, or WebP — max 10 MB</p>
                    </div>
                  </div>
                </div>

                {/* Trending Pics Upload */}
                <div>
                  <label className="text-[13px] font-semibold text-text-primary mb-3 block">Trending Pics (Tinder-style swipe deck)</label>
                  <p className="text-[12px] text-text-muted mb-3">Upload up to 5 photos for people to swipe on you in the Trending section.</p>
                  
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {trendingPics.map((pic, i) => (
                      <div key={i} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={pic} alt={`Trending ${i}`} className="w-full h-full object-cover" />
                        <button 
                          type="button" 
                          onClick={() => removeTrendingPic(i)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs hover:bg-red-500"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {trendingPics.length < 5 && (
                      <div className="relative aspect-[3/4] rounded-xl border border-dashed border-border flex items-center justify-center bg-surface-raised/50 hover:bg-surface-raised cursor-pointer transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) uploadTrendingPic(f);
                            e.target.value = ""; // Reset
                          }}
                          disabled={uploading}
                        />
                        <span className="text-3xl text-text-muted">+</span>
                        {uploading && (
                          <div className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[13px] font-semibold text-text-primary mb-2 block">Display Name</label>
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value.slice(0, 64))}
                    placeholder="How campus sees you"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-semibold text-text-primary mb-2 flex justify-between">
                    <span>Bio</span>
                    <span className="font-mono text-text-muted">{bio.length}/500</span>
                  </label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value.slice(0, 500))}
                    placeholder="Tell the campus about yourself…"
                    rows={4}
                    className="input-field resize-none"
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === "Privacy" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-semibold text-text-primary">Private Account</p>
                  <p className="text-[13px] text-text-muted mt-0.5">Only approved followers can see your posts.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={isPrivate} onChange={() => setIsPrivate(!isPrivate)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-surface-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-text-primary"></div>
                </label>
              </div>

              <div className="border-t border-border pt-6">
                <p className="text-[15px] font-semibold text-text-primary mb-3">Who can message you</p>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="msg" checked={allowMessages === "everyone"} onChange={() => setAllowMessages("everyone")} className="w-4 h-4 accent-text-primary bg-surface-raised border-border" />
                    <span className="text-[14px] text-text-primary">Everyone</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="msg" checked={allowMessages === "followers"} onChange={() => setAllowMessages("followers")} className="w-4 h-4 accent-text-primary bg-surface-raised border-border" />
                    <span className="text-[14px] text-text-primary">Followers Only</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Notifications" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-semibold text-text-primary">Push Notifications</p>
                  <p className="text-[13px] text-text-muted mt-0.5">Get notified for likes, comments, and hot votes.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={notifyLikes} onChange={() => setNotifyLikes(!notifyLikes)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-surface-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-text-primary"></div>
                </label>
              </div>

              <div className="border-t border-border pt-6 flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-semibold text-text-primary">Direct Messages</p>
                  <p className="text-[13px] text-text-muted mt-0.5">Alert me when I receive a new message.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={notifyMessages} onChange={() => setNotifyMessages(!notifyMessages)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-surface-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-text-primary"></div>
                </label>
              </div>
            </div>
          )}

          {activeTab === "AI Preferences" && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-[15px] font-semibold text-text-primary mb-1">Default AI Persona</p>
                <p className="text-[13px] text-text-muted mb-4">Choose how your AI companion should interact with you by default.</p>
                <select 
                  value={aiPersona} 
                  onChange={(e) => setAiPersona(e.target.value)}
                  className="w-full bg-surface-raised border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-text-primary transition-all appearance-none cursor-pointer"
                >
                  <option value="supportive">Supportive & Empathetic</option>
                  <option value="motivational">Motivational Coach</option>
                  <option value="companion">Casual Companion</option>
                  <option value="lover">Romantic Partner (Unrestricted)</option>
                  <option value="uncensored">Fully Uncensored (No Filters)</option>
                </select>
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-[13px] mt-2">{error}</p>}

          <div className="border-t border-border pt-6 mt-2">
            <button type="submit" disabled={saving || uploading} className="btn-primary w-full shadow-lg hover:shadow-xl transition-all">
              {saving ? "Saving…" : saved ? "✓ Saved successfully" : "Save Changes"}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Sign out */}
      <div className="glass-card p-6 border-danger/20">
        <p className="text-xs font-semibold text-danger uppercase tracking-widest mb-4">Account</p>
        <button
          onClick={onLogout}
          className="w-full py-3 rounded-xl border border-danger/30 text-danger font-semibold text-sm hover:bg-danger/10 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
