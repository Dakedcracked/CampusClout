"use client";

import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

type Persona = "supportive" | "motivational" | "companion" | "lover";

const PERSONAS: Record<Persona, { icon: string; label: string; desc: string; color: string }> = {
  supportive: {
    icon: "💙",
    label: "Supportive",
    desc: "Warm, understanding, always here for you",
    color: "text-blue-400",
  },
  motivational: {
    icon: "🔥",
    label: "Motivational",
    desc: "High-energy coach who pushes you to win",
    color: "text-orange-400",
  },
  companion: {
    icon: "🌿",
    label: "Companion",
    desc: "Best friend energy — real, witty, authentic",
    color: "text-green-400",
  },
  lover: {
    icon: "💕",
    label: "Lover",
    desc: "Affectionate, attentive, genuinely devoted",
    color: "text-pink-400",
  },
};

const GREETINGS: Record<Persona, string> = {
  supportive: "I'm here for you, no matter what. What's on your heart today?",
  motivational: "Alright, let's make today count! 🔥 What's your big goal right now?",
  companion: "Hey! What's going on with you? I'm in the mood for real talk.",
  lover: "I was thinking about you 💕 Tell me something that'll make me smile.",
};

export default function AICompanion() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [persona, setPersona] = useState<Persona>("supportive");
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [showPersonas, setShowPersonas] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/v1/ai/companion/history`, { credentials: "include" });
        if (res.ok) {
          const data: Message[] = await res.json();
          setMessages(data);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const switchPersona = async (p: Persona) => {
    setShowPersonas(false);
    if (p === persona) return;
    try {
      const res = await fetch(`${API}/api/v1/ai/companion/persona`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: p }),
      });
      if (res.ok) {
        const data = await res.json();
        setPersona(p);
        setStreak(data.streak ?? 0);
        // Add a system-style note when switching
        const greeting: Message = {
          role: "assistant",
          content: GREETINGS[p],
        };
        setMessages((prev) => [...prev, greeting]);
      }
    } catch {}
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setSending(true);

    try {
      const res = await fetch(`${API}/api/v1/ai/companion/message`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        setStreak(data.streak ?? 0);
        setPersona(data.persona ?? persona);
      }
    } catch {
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const p = PERSONAS[persona];

  return (
    <div className="flex flex-col h-[680px] glass-card overflow-hidden relative">
      {/* Persona picker overlay */}
      {showPersonas && (
        <div className="absolute inset-0 z-20 bg-background/95 backdrop-blur-sm flex flex-col p-6 gap-3">
          <h3 className="font-semibold text-text-primary mb-2">Choose your companion</h3>
          {(Object.entries(PERSONAS) as [Persona, (typeof PERSONAS)[Persona]][]).map(([key, info]) => (
            <button
              key={key}
              onClick={() => switchPersona(key)}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left
                ${persona === key ? "border-accent bg-accent/10" : "border-border hover:border-accent/50 hover:bg-surface"}`}
            >
              <span className="text-2xl">{info.icon}</span>
              <div>
                <p className={`font-semibold ${info.color}`}>{info.label}</p>
                <p className="text-text-muted text-xs">{info.desc}</p>
              </div>
              {persona === key && <span className="ml-auto text-accent text-xs font-mono">active</span>}
            </button>
          ))}
          <button
            onClick={() => setShowPersonas(false)}
            className="mt-2 text-text-muted text-sm hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{p.icon}</span>
          <div>
            <p className="font-semibold text-sm text-text-primary">{p.label} Mode</p>
            <p className={`text-xs ${p.color}`}>{p.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <span className="text-xs font-mono text-accent bg-accent/10 px-2 py-0.5 rounded-full">
              🔗 {streak}d streak
            </span>
          )}
          <button
            onClick={() => setShowPersonas(true)}
            className="text-xs text-text-muted hover:text-text-primary border border-border rounded-lg px-3 py-1.5 transition-colors"
          >
            Switch ▾
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-background">
        {loading && <p className="text-text-muted text-sm text-center mt-8">Loading...</p>}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 pb-8">
            <span className="text-5xl">{p.icon}</span>
            <p className="text-text-primary font-semibold text-lg">{p.label}</p>
            <p className="text-text-muted text-sm text-center max-w-xs">{GREETINGS[persona]}</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={msg.id ?? `${msg.role}-${i}`}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <span className="self-end mb-1 mr-2 text-base flex-shrink-0">{p.icon}</span>
            )}
            <div
              className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-accent text-black rounded-tr-sm font-medium"
                  : "bg-surface border border-border rounded-tl-sm text-text-primary"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start items-end gap-2">
            <span className="text-base">{p.icon}</span>
            <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-2.5">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="flex gap-2 px-4 py-3 bg-surface border-t border-border">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={GREETINGS[persona]}
          maxLength={1000}
          disabled={sending}
          className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm
            text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent
            disabled:opacity-50 transition-colors"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="px-4 py-2.5 bg-accent text-black rounded-xl text-sm font-semibold
            hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          ↑
        </button>
      </form>
    </div>
  );
}
