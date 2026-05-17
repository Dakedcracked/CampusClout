"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGlobalChat } from "@/hooks/useGlobalChat";

export default function GlobalChat({ username }: { username: string }) {
  const { messages, rushHour, connected, sendMessage } = useGlobalChat();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<{ url: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const type = file.type.startsWith("video") ? "video" : "image";
    const objectUrl = URL.createObjectURL(file);
    setSelectedPreview({ url: objectUrl, type });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text && !selectedFile) return;
    if (sending || uploading) return;
    
    setSending(true);
    let finalUrl = null;
    let finalType = null;

    if (selectedFile) {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      try {
        const res = await fetch("/api/v1/upload/image", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          finalUrl = data.url;
          finalType = data.media_type;
        } else {
          alert("Failed to upload file");
          setUploading(false);
          setSending(false);
          return;
        }
      } catch (err) {
        alert("Upload error");
        setUploading(false);
        setSending(false);
        return;
      }
      setUploading(false);
    }

    setDraft("");
    await sendMessage(text, finalUrl, finalType);
    setSelectedFile(null);
    setSelectedPreview(null);
    setSending(false);
  };

  return (
    <div
      className={`flex flex-col h-[600px] rounded-xl border overflow-hidden transition-all duration-500 ${
        rushHour
          ? "border-yellow-400 shadow-[0_0_24px_rgba(234,179,8,0.4)]"
          : "border-border"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 ${
          rushHour ? "bg-yellow-900/30" : "bg-surface"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-text-primary">Campus Chat</span>
          {rushHour && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold animate-pulse">
              ⚡ Rush Hour — 2x tokens
            </span>
          )}
        </div>
        <span
          className={`w-2 h-2 rounded-full ${connected ? "bg-accent" : "bg-text-muted"}`}
          title={connected ? "Live" : "Reconnecting..."}
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-background">
        {messages.length === 0 && (
          <p className="text-text-muted text-sm text-center mt-8">
            Be the first to say something on campus.
          </p>
        )}
        {messages.map((msg, idx) => {
          const isMe = msg.username === username;
          return (
            <div
              key={`${msg.id}-${idx}`}
              className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}
            >
              <Link href={`/profile/${msg.username}`} className="text-text-muted text-xs hover:underline cursor-pointer">
                {msg.username}
              </Link>
              <div
                className={`max-w-[85%] rounded-2xl text-[15px] leading-relaxed break-words overflow-hidden shadow-sm ${
                  isMe
                    ? "bg-[#8b5cf6] text-white rounded-br-sm"
                    : "bg-[#2b2d31] text-[#dbdee1] rounded-bl-sm"
                } ${msg.is_rush_hour ? "ring-2 ring-yellow-400" : ""}`}
              >
                {msg.image_url && msg.image_type === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={msg.image_url}
                    alt="Shared image"
                    className="w-full max-h-[300px] object-cover"
                  />
                )}
                {msg.image_url && msg.image_type === "video" && (
                  <video
                    src={msg.image_url}
                    controls
                    className="w-full max-h-[300px] bg-black"
                  />
                )}
                {msg.content && <div className="px-3 py-2">{msg.content}</div>}
              </div>
              {msg.token_reward > 0 && (
                <span className="text-xs text-text-muted font-mono">
                  +{msg.token_reward} {msg.is_rush_hour && "⚡"}
                </span>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={submit} className="flex flex-col gap-2 px-4 py-3 bg-surface border-t border-border">
        {selectedPreview && (
          <div className="relative w-24 h-24 mb-2">
            {selectedPreview.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedPreview.url} alt="Preview" className="w-full h-full object-cover rounded-xl border-2 border-[#8b5cf6]" />
            ) : (
              <video src={selectedPreview.url} className="w-full h-full object-cover rounded-xl border-2 border-[#8b5cf6]" />
            )}
            <button
              type="button"
              onClick={() => { setSelectedFile(null); setSelectedPreview(null); }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg hover:scale-110 transition-transform"
            >
              ✕
            </button>
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                <span className="text-xs text-white animate-pulse">Uploading...</span>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={rushHour ? "Rush Hour — earn 2x tokens..." : "Message Campus..."}
            maxLength={500}
            className="flex-1 bg-[#383a40] border-none rounded-full px-4 py-2.5 text-[15px]
              text-white placeholder:text-[#949ba4] focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/50 transition-all"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-full bg-[#2b2d31] flex items-center justify-center text-white hover:bg-[#383a40] transition-colors"
            title="Attach file"
          >
            📎
          </button>
          <button
            type="submit"
            disabled={(!draft.trim() && !selectedFile) || sending || uploading}
            className="w-10 h-10 rounded-full bg-[#8b5cf6] flex items-center justify-center text-white font-medium
              hover:bg-[#7c3aed] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-purple-500/20"
          >
            {sending ? "..." : "➤"}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleImageSelect}
          className="hidden"
        />
      </form>
    </div>
  );
}
