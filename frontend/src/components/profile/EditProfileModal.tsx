"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ImageUploader from "@/components/upload/ImageUploader";
import { cn } from "@/lib/utils";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBio: string | null;
  currentAvatarUrl: string | null;
  currentCoverUrl: string | null;
  onSave: (data: {
    bio: string;
    avatar_url?: string;
    cover_url?: string;
  }) => Promise<void>;
}

type Tab = "images" | "bio";

export default function EditProfileModal({
  isOpen,
  onClose,
  currentBio,
  currentAvatarUrl,
  currentCoverUrl,
  onSave,
}: EditProfileModalProps) {
  const [tab, setTab] = useState<Tab>("images");
  const [bio, setBio] = useState(currentBio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [coverUrl, setCoverUrl] = useState(currentCoverUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await onSave({
        bio,
        ...(avatarUrl !== currentAvatarUrl && { avatar_url: avatarUrl ?? undefined }),
        ...(coverUrl !== currentCoverUrl && { cover_url: coverUrl ?? undefined }),
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setBio(currentBio ?? "");
    setAvatarUrl(currentAvatarUrl);
    setCoverUrl(currentCoverUrl);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto z-50"
          >
            <div className="glass-card p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <h2 className="text-2xl font-bold text-text-primary">
                  Edit Profile
                </h2>
                <button
                  onClick={onClose}
                  className="text-text-muted hover:text-text-primary transition-colors text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 border-b border-border">
                {["images", "bio"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t as Tab)}
                    className={cn(
                      "px-4 py-2 font-medium transition-colors border-b-2",
                      tab === t
                        ? "text-accent border-accent"
                        : "text-text-muted border-transparent hover:text-text-secondary"
                    )}
                  >
                    {t === "images" ? "Images" : "Bio"}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="min-h-96">
                {tab === "images" ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary mb-3">
                        Profile Picture
                      </h3>
                      <ImageUploader
                        imageType="avatar"
                        label="Profile Picture"
                        endpoint="/api/v1/upload/profile-pic"
                        onUpload={setAvatarUrl}
                      />
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-text-primary mb-3">
                        Cover Image
                      </h3>
                      <ImageUploader
                        imageType="cover"
                        label="Cover Image"
                        endpoint="/api/v1/upload/cover"
                        onUpload={setCoverUrl}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-3">
                      Bio
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value.slice(0, 500))}
                      placeholder="Tell us about yourself..."
                      className={cn(
                        "w-full p-4 rounded-lg bg-surface border border-border text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-clout transition-colors",
                        "min-h-40"
                      )}
                    />
                    <p className="text-xs text-text-muted mt-2">
                      {bio.length}/500 characters
                    </p>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-3 bg-danger/10 border border-danger rounded-lg text-sm text-danger"
                >
                  {error}
                </motion.div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-border">
                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-surface transition-colors disabled:opacity-50"
                >
                  Reset
                </button>
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-surface transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className={cn(
                    "px-6 py-2 rounded-lg font-medium transition-colors",
                    loading
                      ? "bg-clout/50 text-background cursor-not-allowed"
                      : "bg-clout text-background hover:bg-clout-hover"
                  )}
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
