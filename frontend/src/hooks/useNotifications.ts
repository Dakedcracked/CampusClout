"use client";

import { useState, useEffect, useCallback } from "react";

export interface Notification {
  id: string;
  notification_type: string;
  actor_id?: string;
  actor_username?: string;
  actor_avatar?: string;
  content: string;
  is_read: boolean;
  created_at: string;
  post_id?: string;
  room_id?: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/notifications/inbox?limit=50", {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch notifications");

      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(
        data.notifications?.filter((n: Notification) => !n.is_read).length || 0
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  const getUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications/unread-count", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error("Error fetching unread count:", err);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const res = await fetch(
        `/api/v1/notifications/${notificationId}/read`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    getUnreadCount();

    // Poll every 30s
    const interval = setInterval(getUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, getUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
