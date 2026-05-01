"use client";

import { useEffect, useRef, useState } from "react";
import { useGlobalChat } from "@/hooks/useGlobalChat";

export default function GlobalChat({ username }: { username: string }) {
  const { messages, rushHour, connected, sendMessage } = useGlobalChat();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64 for now (in production, use proper upload service)
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setSelectedImage({
        url: base64,
        type: file.type.startsWith("video") ? "video" : "image",
      });
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text && !selectedImage) return;
    if (sending) return;
    
    setSending(true);
    setDraft("");
    await sendMessage(text, selectedImage?.url, selectedImage?.type);
    setSelectedImage(null);
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
              <span className="text-text-muted text-xs">{msg.username}</span>
              <div
                className={`max-w-[75%] rounded-2xl text-sm break-words overflow-hidden ${
                  isMe
                    ? "bg-accent text-black rounded-tr-sm"
                    : "bg-surface border border-border rounded-tl-sm"
                } ${msg.is_rush_hour ? "ring-1 ring-yellow-400" : ""}`}
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
        {selectedImage && (
          <div className="relative w-20 h-20">
            {selectedImage.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedImage.url} alt="Preview" className="w-full h-full object-cover rounded" />
            ) : (
              <video src={selectedImage.url} className="w-full h-full object-cover rounded" />
            )}
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={rushHour ? "Rush Hour — earn 2x tokens..." : "Say something on campus..."}
            maxLength={500}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm
              text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-[#333] text-white rounded-lg text-sm hover:bg-[#444] transition-colors"
            title="Add image or video"
          >
            🖼️
          </button>
          <button
            type="submit"
            disabled={(!draft.trim() && !selectedImage) || sending}
            className="px-4 py-2 bg-accent text-black rounded-lg text-sm font-medium
              hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
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
