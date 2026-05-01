"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatMsg {
  id: string;
  thread_id: string;
  sender_id: string | null;
  sender_username: string | null;
  content: string;
  token_cost: number;
  is_ai_icebreaker: boolean;
  created_at: string;
}

interface WsPayload {
  type: "message" | "icebreaker" | "error";
  message?: ChatMsg;
  error?: string;
}

const WS_BASE =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8000/api/v1/ws/chat`
    : "";

async function fetchTicket(): Promise<string | null> {
  try {
    const res = await fetch("/api/v1/auth/ws-ticket", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const { ticket } = await res.json();
    return ticket as string;
  } catch {
    return null;
  }
}

export function useChatWebSocket(threadId: string | null) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connect = useCallback(async () => {
    if (!threadId || !WS_BASE || !mountedRef.current) return;

    const ticket = await fetchTicket();
    if (!ticket || !mountedRef.current) return;

    const url = `${WS_BASE}/${threadId}?ticket=${encodeURIComponent(ticket)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current) setConnected(true);
      if (pingRef.current) clearInterval(pingRef.current);
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        else { clearInterval(pingRef.current!); pingRef.current = null; }
      }, 25_000);
    };

    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data) as WsPayload;
        if (payload.message && (payload.type === "message" || payload.type === "icebreaker")) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.message!.id)) return prev;
            return [...prev, payload.message!];
          });
        }
      } catch {
        // ignore malformed
      }
    };

    ws.onclose = (ev) => {
      if (!mountedRef.current) return;
      setConnected(false);
      // 4001 = bad ticket, 4003 = not participant — don't retry
      if (ev.code !== 4001 && ev.code !== 4003) {
        reconnectRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => ws.close();
  }, [threadId]);

  // Load history when thread changes
  useEffect(() => {
    if (!threadId) { setMessages([]); return; }
    setMessages([]);
    fetch(`/api/v1/chat/threads/${threadId}/messages?limit=50`, { credentials: "include" })
      .then((r) => r.json())
      .then((msgs: ChatMsg[]) => { if (mountedRef.current) setMessages(msgs); })
      .catch(() => {});
  }, [threadId]);

  // WebSocket connection
  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);

  function appendMessage(msg: ChatMsg) {
    setMessages((prev) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
    );
  }

  return { messages, connected, appendMessage };
}
