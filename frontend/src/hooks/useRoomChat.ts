"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface RoomMessage {
  id: string;
  sender_id: string;
  username: string;
  content: string;
  timestamp: string;
  is_pinned: boolean;
}

export interface RoomEvent {
  type: "message" | "member_joined" | "member_left";
  sender_id?: string;
  username?: string;
  content?: string;
  timestamp?: string;
  message_id?: string;
}

export function useRoomChat(roomId: string, enabled: boolean = true) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    if (!enabled || !roomId) return;

    try {
      // Get WS ticket from backend
      const ticketRes = await fetch("/api/v1/auth/ws-ticket", {
        method: "POST",
        credentials: "include",
      });

      if (!ticketRes.ok) {
        throw new Error("Failed to get WS ticket");
      }

      const { ticket } = await ticketRes.json();

      // Connect to WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/v1/rooms/ws/${roomId}?ticket=${ticket}`;
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);

        // Send ping every 25s to keep connection alive
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as RoomEvent;

          if (data.type === "message") {
            const msg: RoomMessage = {
              id: data.message_id || "",
              sender_id: data.sender_id || "",
              username: data.username || "Unknown",
              content: data.content || "",
              timestamp: data.timestamp || new Date().toISOString(),
              is_pinned: false,
            };
            setMessages((prev) => [...prev, msg]);
          }
        } catch (err) {
          console.error("Failed to parse message:", err);
        }
      };

      ws.onerror = () => {
        setError("Connection error");
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingRef.current) clearInterval(pingRef.current);
      };

      wsRef.current = ws;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setIsConnected(false);
    }
  }, [roomId, enabled]);

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("Not connected");
      return;
    }

    try {
      wsRef.current.send(
        JSON.stringify({
          type: "message",
          content,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (pingRef.current) clearInterval(pingRef.current);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    setIsConnected(false);
    setMessages([]);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    messages,
    isConnected,
    error,
    sendMessage,
    disconnect,
  };
}
