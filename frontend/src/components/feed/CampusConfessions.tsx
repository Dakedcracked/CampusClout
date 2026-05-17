"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Confession {
  id: string;
  content: string;
  like_count: number;
  created_at: string;
  is_liked: boolean;
  media_url?: string | null;
  media_type?: string | null;
}

export default function CampusConfessions() {
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX = 280;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  useEffect(() => {
    loadConfessions();
  }, []);

  async function loadConfessions() {
    try {
      const res = await fetch("/api/v1/feed?limit=20", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setConfessions(Array.isArray(data) ? data.filter((p: {is_alter_ego_post?: boolean}) => p.is_alter_ego_post).map((p: any) => ({
          id: p.id,
          content: p.content,
          like_count: p.like_count,
          created_at: p.created_at,
          is_liked: false,
          media_url: p.media_url,
          media_type: p.media_type,
        })) : []);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG, GIF, and WebP images are allowed");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      return;
    }

    // Validate filename (prevent directory traversal)
    const filename = file.name.toLowerCase();
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      setError("Invalid filename");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    setSelectedFile(file);
    setError(null);
  }

  async function submitConfession() {
    if (!text.trim() && !selectedFile) {
      setError("Please add some text or an image");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let mediaUrl = null;
      let mediaType = null;

      // Upload image if selected
      if (selectedFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append("file", selectedFile);
        const uploadRes = await fetch("/api/v1/upload/image", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error("Image upload failed");
        }

        const uploadData = await uploadRes.json();
        mediaUrl = uploadData.url;
        mediaType = "image";
        setUploading(false);
      }

      const res = await fetch("/api/v1/feed", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text.trim(),
          post_as_alter_ego: true,
          media_url: mediaUrl,
          media_type: mediaType,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to post confession");
      }

      const newPost = await res.json();
      setConfessions((prev) => [{
        id: newPost.id,
        content: newPost.content,
        like_count: 0,
        created_at: newPost.created_at,
        is_liked: false,
        media_url: newPost.media_url,
        media_type: newPost.media_type,
      }, ...prev]);
      setText("");
      setSelectedFile(null);
      setImagePreview(null);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post confession");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  async function likeConfession(id: string) {
    try {
      await fetch(`/api/v1/feed/${id}/like`, { method: "POST", credentials: "include" });
      setConfessions((prev) =>
        prev.map((c) => c.id === id
          ? { ...c, is_liked: !c.is_liked, like_count: c.is_liked ? c.like_count - 1 : c.like_count + 1 }
          : c
        )
      );
    } catch { /* silent */ }
  }

  function timeAgo(iso: string) {
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
    return `${Math.floor(secs / 86400)}d`;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            Campus Confessions <span>🤫</span>
          </h2>
          <p className="text-xs text-[#555] mt-0.5">100% anonymous · AI moderated · your alter-ego speaks</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold shadow-lg"
        >
          + Confess
        </motion.button>
      </div>

      {/* Confession form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-200">
                  {error}
                </div>
              )}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-sm">👻</div>
                <span className="text-xs text-[#777]">Posting as <strong className="text-purple-400">Anonymous</strong></span>
              </div>

              {/* Image preview */}
              {imagePreview && (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="max-h-40 rounded-lg w-full object-cover" />
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 hover:bg-black transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )}

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX))}
                placeholder="Share something secretly... 🤫"
                rows={3}
                className="w-full bg-transparent text-white placeholder-[#444] resize-none focus:outline-none text-[15px] leading-relaxed"
              />
              <div className="flex items-center justify-between">
                <span className={`text-xs font-mono ${MAX - text.length < 30 ? "text-red-400" : "text-[#444]"}`}>
                  {MAX - text.length}
                </span>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={uploading}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || submitting}
                    className="px-3 py-1.5 rounded-lg text-xs text-[#666] hover:text-white disabled:opacity-50 transition-colors"
                  >
                    🖼️ {uploading ? "Uploading..." : "Image"}
                  </button>
                  <button onClick={() => {
                    setShowForm(false);
                    setError(null);
                  }} className="px-3 py-1.5 rounded-lg text-xs text-[#666] hover:text-white">
                    Cancel
                  </button>
                  <button
                    onClick={submitConfession}
                    disabled={(!text.trim() && !selectedFile) || submitting || uploading}
                    className="px-4 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold disabled:opacity-50 hover:bg-purple-500 transition-colors"
                  >
                    {submitting ? "Posting..." : "Share 👻"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confessions list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 animate-pulse">
              <div className="h-4 bg-[#1a1a1a] rounded w-3/4 mb-2" />
              <div className="h-3 bg-[#1a1a1a] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : confessions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🤫</p>
          <p className="text-[#555] text-sm">No confessions yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {confessions.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5 hover:border-[#2a2a2a] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-800 to-pink-800 flex items-center justify-center text-xl flex-shrink-0">
                    👻
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-[#a78bfa]">Anonymous</span>
                      <span className="text-[10px] text-[#444]">{timeAgo(c.created_at)} ago</span>
                    </div>
                    <p className="text-[15px] text-[#ddd] leading-relaxed whitespace-pre-wrap">{c.content}</p>
                    {c.media_url && c.media_type === "image" && (
                      <img src={c.media_url} alt="Confession" className="mt-3 max-h-64 rounded-lg max-w-full object-cover" />
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      <button
                        onClick={() => likeConfession(c.id)}
                        className={`flex items-center gap-1.5 text-xs transition-colors ${c.is_liked ? "text-pink-400" : "text-[#555] hover:text-pink-400"}`}
                      >
                        {c.is_liked ? "❤️" : "🤍"} {c.like_count}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
