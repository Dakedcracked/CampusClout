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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

        <form onSubmit={save} className="flex flex-col gap-5">
          {/* Account info (read-only) */}
          <div className="flex flex-col gap-3 p-4 rounded-xl bg-surface-raised border border-border">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">Account</p>
            <div className="grid grid-cols-2 gap-3">
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
                <p className={`text-sm font-semibold ${user.is_verified ? "text-accent" : "text-warning"}`}>
                  {user.is_verified ? "✓ Verified" : "⚠ Unverified"}
                </p>
              </div>
            </div>
          </div>

          {/* Profile fields */}
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">Profile</p>

            {/* Avatar upload */}
            <div>
              <label className="text-xs text-text-muted mb-2 block">Profile Photo</label>
              <div className="flex items-center gap-4">
                {/* Current avatar preview */}
                <div className="relative flex-shrink-0">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="w-16 h-16 rounded-full object-cover border-2 border-border"
                      onError={e => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center font-black text-white text-2xl border-2 border-border"
                      style={{ background: `linear-gradient(135deg, ${avatarBg}, ${avatarBg}99)` }}
                    >
                      {((user.display_name ?? user.username)?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="btn-secondary text-sm disabled:opacity-50"
                  >
                    {uploading ? "Uploading…" : "📷 Upload Photo"}
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
                  <p className="text-[11px] text-text-muted">JPEG, PNG, or WebP — max 10 MB</p>
                </div>
              </div>

              {/* URL fallback input */}
              <div className="mt-3">
                <label className="text-[11px] text-text-muted mb-1 block">Or paste an image URL</label>
                <input
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  placeholder="https://…"
                  className="input-field text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted mb-1.5 block">Display Name</label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value.slice(0, 64))}
                placeholder="How campus sees you"
                className="input-field"
              />
            </div>

            <div>
              <label className="text-xs text-text-muted mb-1.5 block">
                Bio <span className="font-mono">{bio.length}/500</span>
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

          {error && <p className="text-danger text-sm">{error}</p>}

          <button type="submit" disabled={saving || uploading} className="btn-primary w-full">
            {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Changes"}
          </button>
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
