"use client";

import { useRef, useState } from "react";
import type { Post } from "./PostCard";
import { safeJsonParse, getErrorMessage } from "@/lib/safe-json";

const MAX_CHARS = 500;

export default function CreatePost({
  onCreated,
  alterEgoActive,
  alterEgoAlias,
  userAvatar,
  username,
}: {
  onCreated: (post: Post) => void;
  alterEgoActive: boolean;
  alterEgoAlias: string | null;
  userAvatar?: string | null;
  username?: string;
}) {
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [postAsAlterEgo, setPostAsAlterEgo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  function pickMedia(file: File) {
    setMediaFile(file);
    setMediaType(file.type.startsWith("video/") ? "video" : "image");
    setMediaPreview(URL.createObjectURL(file));
  }

  function removeMedia() {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if (imageRef.current) imageRef.current.value = "";
    if (videoRef.current) videoRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && !mediaFile) return;
    setSubmitting(true);
    setError(null);

    let mediaUrl: string | null = null;
    let finalMediaType: string | null = null;

    if (mediaFile) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", mediaFile);
        const upRes = await fetch("/api/v1/upload/image", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        if (upRes.ok) {
          const upData = await upRes.json();
          mediaUrl = upData.url;
          finalMediaType = upData.media_type;
        } else {
          setError("Media upload failed. Try again.");
          setSubmitting(false);
          setUploading(false);
          return;
        }
      } finally {
        setUploading(false);
      }
    }

    try {
      const res = await fetch("/api/v1/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: content.trim(),
          post_as_alter_ego: postAsAlterEgo,
          media_url: mediaUrl,
          media_type: finalMediaType,
        }),
      });
      
      const d = await safeJsonParse(res);
      if (!res.ok) {
        setError(getErrorMessage(d, res.statusText));
        return;
      }
      
      if (!d) {
        setError("Invalid response from server");
        return;
      }
      
      onCreated(d as Post);
      setContent("");
      removeMedia();
      setPostAsAlterEgo(false);
      setFocused(false);
    } finally {
      setSubmitting(false);
    }
  }

  const remaining = MAX_CHARS - content.length;
  const canPost = (content.trim().length > 0 || !!mediaFile) && !submitting;
  const initials = (username?.[0] ?? "?").toUpperCase();
  const colors = ["#9d4edd", "#f472b6", "#60a5fa", "#00e5a0", "#fbbf24"];
  const avatarBg = username ? colors[username.charCodeAt(0) % colors.length] : colors[0];

  return (
    <form onSubmit={submit} className="bg-transparent border-b border-[#262626] pb-4 mb-4">
      <div className="p-4 flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 mt-0.5">
          {userAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userAvatar} alt="" className="w-9 h-9 rounded-full object-cover story-ring" />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white story-ring"
              style={{ background: `linear-gradient(135deg, ${avatarBg}, ${avatarBg}bb)` }}
            >
              {initials}
            </div>
          )}
        </div>

        {/* Text + media */}
        <div className="flex-1 min-w-0">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
            onFocus={() => setFocused(true)}
            placeholder={
              postAsAlterEgo && alterEgoAlias
                ? `Posting as @${alterEgoAlias}…`
                : "Start a thread..."
            }
            rows={focused || mediaFile ? 3 : 1}
            className="w-full bg-transparent text-[15px] text-[#f5f5f5] placeholder-[#555] focus:outline-none resize-none leading-relaxed transition-all duration-200 mt-1"
          />

          {/* Media preview */}
          {mediaPreview && (
            <div className="relative mt-3 rounded-xl overflow-hidden border border-[#2a2a2a]">
              {mediaType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaPreview} alt="Preview" className="w-full max-h-72 object-cover" />
              ) : (
                <video src={mediaPreview} controls className="w-full max-h-72" />
              )}
              <button
                type="button"
                onClick={removeMedia}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/75 text-white text-xs flex items-center justify-center hover:bg-black transition-colors"
              >
                ✕
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>
      </div>

      {/* Toolbar */}
      {(focused || !!mediaFile) && (
        <div className="pl-14 pr-4 mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => imageRef.current?.click()}
              title="Add photo"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </button>
            <input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickMedia(f); }} />

            <button
              type="button"
              onClick={() => videoRef.current?.click()}
              title="Add video"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#1a1a1a] transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            </button>
            <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickMedia(f); }} />

            {alterEgoActive && alterEgoAlias && (
              <label className="flex items-center gap-1.5 ml-2 cursor-pointer select-none">
                <input type="checkbox" checked={postAsAlterEgo} onChange={(e) => setPostAsAlterEgo(e.target.checked)} className="accent-violet-500 w-3.5 h-3.5" />
                <span className="text-xs text-[#a78bfa]">as @{alterEgoAlias}</span>
              </label>
            )}

            <span className={`text-xs font-mono ml-2 ${remaining < 50 ? "text-red-400" : "text-[#444]"}`}>
              {remaining}
            </span>
          </div>

          <button type="submit" disabled={!canPost} className="bg-white text-black font-semibold rounded-full px-5 py-1.5 text-[14px] disabled:opacity-50 hover:bg-[#e5e5e5] transition-colors">
            {uploading ? "Uploading…" : submitting ? "Posting…" : "Post"}
          </button>
        </div>
      )}
    </form>
  );
}
