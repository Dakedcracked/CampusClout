"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar_url: string | null;
  content: string;
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
        const proto = window.location.protocol === "https:" ? "wss" : "ws";
        const wsUrl = `${proto}://${window.location.host}/api/v1/rooms/ws/${roomId}?ticket=${ticket}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setError(null);
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
          console.error("WS error:", event);
          setError("Connection error. Trying to reconnect...");
        };

        ws.onclose = (event) => {
          if (event.code === 4001 || event.code === 4003 || event.code === 4004) {
            setError(`Connection closed: ${event.reason || "unknown error"}`);
          } else if (!event.wasClean) {
            setError("Room connection lost. Refresh to reconnect.");
          }
        };

        wsRef.current = ws;

        return () => {
          ws.close();
        };
      } catch (err) {
        console.error("WS connection error:", err);
        setError("Failed to connect to room");
      }
    }

    connectWs();
  }, [roomId]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: input.trim() }),
      });

      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
        setInput("");
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
              <div className="w-8 h-8 rounded-full bg-neon-purple/30 flex-shrink-0 flex items-center justify-center text-xs font-bold">
                {(msg.sender_username?.[0] ?? "?").toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-semibold text-sm text-text-primary">
                    {msg.sender_username}
                  </span>
                  <span className="text-xs text-text-muted">
                    {timeAgo(msg.created_at)}
                  </span>
                  {msg.is_pinned && (
                    <span className="text-xs bg-neon-purple/20 text-neon-purple px-2 py-0.5 rounded">
                      📌 Pinned
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-secondary break-words">
                  {msg.content}
                </p>
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
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
