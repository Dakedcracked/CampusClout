"use client";

import { useEffect, useRef, useState } from "react";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import MessageBubble from "./MessageBubble";
import { cn } from "@/lib/utils";

interface Props {
  threadId: string;
  myUserId: string;
  otherUsername: string;
  otherMarketCap: number;
  myMarketCap: number;
  onBack: () => void;
}

function dmCost(senderCap: number, targetCap: number): number {
  if (targetCap <= senderCap) return 0;
  return Math.min(Math.floor((targetCap - senderCap) / 100), 50);
}

export default function ChatThread({
  threadId,
  myUserId,
  otherUsername,
  otherMarketCap,
  myMarketCap,
  onBack,
}: Props) {
  const { messages, connected, appendMessage } = useChatWebSocket(threadId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cost = dmCost(myMarketCap, otherMarketCap);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/chat/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: input }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.detail ?? "Failed to send");
        return;
      }
      appendMessage(d);
      setInput("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
        <button
          onClick={onBack}
          className="text-text-muted hover:text-text-primary text-sm transition-colors"
        >
          ← Back
        </button>
        <div className="flex-1">
          <p className="font-semibold">@{otherUsername}</p>
          <p className="text-xs text-text-muted font-mono">
            {otherMarketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })} cap
          </p>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs",
            connected ? "text-accent" : "text-text-muted"
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              connected ? "bg-accent animate-pulse" : "bg-border"
            )}
          />
          {connected ? "Live" : "Reconnecting…"}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1 px-1 mb-4">
        {messages.length === 0 && (
          <p className="text-xs text-text-muted text-center my-auto">
            No messages yet. Say hi!
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} myUserId={myUserId} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-danger mb-2 px-1">{error}</p>
      )}

      {/* Cost hint */}
      {cost > 0 && (
        <p className="text-xs text-clout font-mono mb-2 px-1">
          Each message costs {cost}◈ (cap gap: {Math.round(otherMarketCap - myMarketCap).toLocaleString()})
        </p>
      )}
      {cost === 0 && (
        <p className="text-xs text-accent font-mono mb-2 px-1">
          Free to message ◈
        </p>
      )}

      {/* Input */}
      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          maxLength={1000}
          className="flex-1 bg-surface-raised border border-border rounded-xl px-4 py-2.5 text-sm
                     text-text-primary placeholder-text-muted focus:outline-none focus:border-accent
                     transition-colors"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-4 py-2.5 bg-accent text-background text-sm font-semibold rounded-xl
                     hover:bg-accent-hover transition-colors disabled:opacity-40"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
