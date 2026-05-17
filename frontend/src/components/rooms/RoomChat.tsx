"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar_url: string | null;
  content: string;
  image_url?: string | null;
  image_type?: string | null;
  is_pinned: boolean;
  created_at: string;
}

interface RoomChatProps {
  roomId: string;
  userId: string;
  username: string;
}

export default function RoomChat({ roomId, userId, username }: RoomChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial messages
  useEffect(() => {
    async function loadMessages() {
      try {
        const res = await fetch(`/api/v1/rooms/${roomId}/messages?limit=50`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(Array.isArray(data) ? data : data.messages || []);
        } else {
          const errData = await res.json().catch(() => ({}));
          setError(errData.detail || `Failed to load messages (${res.status})`);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, [roomId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Connect to WebSocket
  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout: NodeJS.Timeout;

    async function connectWs() {
      try {
        const ticketRes = await fetch("/api/v1/auth/ws-ticket", {
          method: "POST",
          credentials: "include",
        });
        if (!ticketRes.ok) {
          setError("Failed to get WebSocket ticket");
          return;
        }

        const { ticket } = await ticketRes.json();
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const wsBaseUrl = API_URL.replace(/^http/, "ws");
        const wsUrl = `${wsBaseUrl}/api/v1/rooms/ws/${roomId}?ticket=${ticket}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setError(null);
          reconnectAttempts = 0; // Reset on successful connection
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "message") {
              setMessages((prev) => [...prev, data.message]);
            } else if (data.type === "typing_start") {
              setTyping((prev) =>
                prev.includes(data.username)
                  ? prev
                  : [...prev, data.username]
              );
            } else if (data.type === "typing_end") {
              setTyping((prev) =>
                prev.filter((u) => u !== data.username)
              );
            }
          } catch (err) {
            console.error("WS message parse error:", err);
          }
        };

        ws.onerror = (event) => {
          const errorMsg = event instanceof Event ? "WebSocket connection error" : String(event);
          console.error("WS error:", errorMsg);
          setError(`Connection error: ${errorMsg || "Unknown error"}. Attempting to reconnect...`);
        };

        ws.onclose = (event) => {
          // 1000 = normal close, 1001 = going away
          if (event.code === 1000 || event.code === 1001) {
            return; // Normal close, don't reconnect
          }

          if (event.code === 4001 || event.code === 4003 || event.code === 4004) {
            setError(`Connection closed: ${event.reason || `Code ${event.code}`}`);
            return;
          }

          // Attempt to reconnect with exponential backoff
          if (reconnectAttempts < maxReconnectAttempts) {
            const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            setError(`Connection lost. Reconnecting in ${backoffMs / 1000}s...`);
            reconnectTimeout = setTimeout(() => {
              reconnectAttempts++;
              connectWs();
            }, backoffMs);
          } else {
            setError("Room connection lost. Please refresh to reconnect.");
          }
        };

        wsRef.current = ws;

        return () => {
          clearTimeout(reconnectTimeout);
          ws.close();
        };
      } catch (err) {
        console.error("WS connection error:", err);
        setError(`Failed to connect: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    connectWs();

    return () => {
      clearTimeout(reconnectTimeout);
    };
  }, [roomId]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() && !selectedFile) return;
    if (sending || uploading) return;

    setSending(true);
    setError(null);
    let finalUrl = null;
    let finalType = null;

    try {
      if (selectedFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append("file", selectedFile);
        const res = await fetch("/api/v1/upload/image", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          finalUrl = data.url;
          finalType = data.media_type;
        } else {
          setError("Failed to upload file");
          setUploading(false);
          setSending(false);
          return;
        }
        setUploading(false);
      }

      const payload: any = { content: input.trim() };
      if (finalUrl) payload.image_url = finalUrl;
      if (finalType) payload.image_type = finalType;

      const res = await fetch(`/api/v1/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
        setInput("");
        setSelectedFile(null);
        setSelectedPreview(null);
        setTyping((prev) => prev.filter((u) => u !== username));

        // Send typing_end signal
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "typing_end" }));
        }
      } else {
        setError("Failed to send message");
      }
    } catch (err) {
      console.error("Send error:", err);
      setError("Network error");
    } finally {
      setSending(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);

    // Send typing indicator
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing_start" }));
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "typing_end" }));
      }
    }, 3000);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.ctrlKey && e.key === "Enter") {
      handleSendMessage(e as unknown as React.FormEvent);
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!confirm("Delete this message?")) return;

    try {
      const res = await fetch(
        `/api/v1/rooms/${roomId}/messages/${messageId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  function timeAgo(iso: string): string {
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return "now";
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
    return `${Math.floor(secs / 86400)}d`;
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File too large. Max 10MB.");
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setSelectedPreview(url);
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-border bg-surface/50">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center py-12 text-text-muted">
            <p className="animate-pulse">Loading messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="flex gap-3 group hover:bg-surface/50 p-2 rounded-lg transition-colors"
            >
              <Link href={`/profile/${msg.sender_username}`} className="w-8 h-8 rounded-full bg-neon-purple/30 flex-shrink-0 flex items-center justify-center text-xs font-bold hover:opacity-80 transition-opacity">
                {(msg.sender_username?.[0] ?? "?").toUpperCase()}
              </Link>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <Link href={`/profile/${msg.sender_username}`} className="font-semibold text-sm text-text-primary hover:underline cursor-pointer">
                    {msg.sender_username}
                  </Link>
                  <span className="text-xs text-text-muted">
                    {timeAgo(msg.created_at)}
                  </span>
                  {msg.is_pinned && (
                    <span className="text-xs bg-neon-purple/20 text-neon-purple px-2 py-0.5 rounded">
                      📌 Pinned
                    </span>
                  )}
                </div>
                {msg.content && (
                  <p className="text-sm text-text-secondary break-words">
                    {msg.content}
                  </p>
                )}
                {msg.image_url && (
                  <div className="mt-2 max-w-[240px] rounded-lg overflow-hidden border border-border/50">
                    {msg.image_type?.startsWith("video/") ? (
                      <video
                        src={msg.image_url}
                        controls
                        className="w-full h-auto object-cover max-h-[300px]"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={msg.image_url}
                        alt="attachment"
                        className="w-full h-auto object-cover max-h-[300px]"
                        loading="lazy"
                      />
                    )}
                  </div>
                )}
              </div>

              {userId === msg.sender_id && (
                <button
                  onClick={() => handleDeleteMessage(msg.id)}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-opacity text-xs p-1"
                >
                  🗑️
                </button>
              )}
            </div>
          ))
        )}

        {typing.length > 0 && (
          <div className="text-xs text-text-muted italic py-2">
            {typing.join(", ")} {typing.length === 1 ? "is" : "are"} typing…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 space-y-2">
        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
            {error}
          </p>
        )}

        {selectedPreview && (
          <div className="relative inline-block mt-2">
            {selectedFile?.type.startsWith("video/") ? (
              <video src={selectedPreview} className="h-20 w-auto rounded border border-border" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedPreview} alt="Preview" className="h-20 w-auto rounded border border-border object-cover" />
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setSelectedPreview(null);
              }}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Ctrl+Enter to send)"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-neon-purple/50 resize-none"
          />

          <div className="flex items-center gap-2">
            <label className="cursor-pointer text-text-muted hover:text-accent transition-colors p-2 bg-surface rounded-lg border border-border">
              📸
              <input
                type="file"
                className="hidden"
                accept="image/*,video/mp4,video/webm"
                onChange={handleFileSelect}
                disabled={sending || uploading}
              />
            </label>
            <button
              type="submit"
              disabled={(!input.trim() && !selectedFile) || sending || uploading}
              className="btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending || uploading ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
