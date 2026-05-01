"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "like" | "comment" | "follow" | "rating" | "ai_suggestion" | "invite";
  actor_username: string;
  actor_display_name: string | null;
  actor_avatar_url: string | null;
  message: string;
  timestamp: string;
  is_read: boolean;
  related_id: string | null;
  related_type: string | null;
}

interface InboxProps {
  myUserId?: string;
}

const icons: Record<Notification["type"], string> = {
  like: "❤️",
  comment: "💬",
  follow: "👥",
  rating: "⭐",
  ai_suggestion: "✨",
  invite: "📬",
};

const colors: Record<Notification["type"], string> = {
  like: "text-danger",
  comment: "text-accent",
  follow: "text-clout",
  rating: "text-warning",
  ai_suggestion: "text-accent",
  invite: "text-accent",
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 2592000) return `${Math.floor(secs / 86400)}d ago`;
  return `${Math.floor(secs / 2592000)}mo ago`;
}

export default function Inbox({}: InboxProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "type">("all");
  const [selectedType] = useState<Notification["type"] | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        skip: ((pageNum - 1) * 20).toString(),
        limit: "20",
      });

      if (filter === "unread") {
        params.append("unread_only", "true");
      }

      if (selectedType) {
        params.append("type", selectedType);
      }

      const res = await fetch(`/api/v1/notifications?${params.toString()}`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications(pageNum === 1 ? data : [...notifications, ...data]);
        setHasMore(data.length >= 20);
        setPage(pageNum);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await fetch(`/api/v1/notifications/${notifId}/read`, {
        method: "PUT",
        credentials: "include",
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
    } catch {
      // Error
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch("/api/v1/notifications/read-all", {
        method: "PUT",
        credentials: "include",
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // Error
    }
  };

  const handleDelete = async (notifId: string) => {
    try {
      await fetch(`/api/v1/notifications/${notifId}`, {
        method: "DELETE",
        credentials: "include",
      });

      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    } catch {
      // Error
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    handleMarkAsRead(notif.id);

    if (notif.related_type === "post") {
      router.push(`/feed/${notif.related_id}`);
    } else if (notif.related_type === "profile") {
      router.push(`/profile/${notif.actor_username}`);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread" && n.is_read) return false;
    if (selectedType && n.type !== selectedType) return false;
    return true;
  });

  const groupedByType = {
    likes: filteredNotifications.filter((n) => n.type === "like"),
    comments: filteredNotifications.filter((n) => n.type === "comment"),
    follows: filteredNotifications.filter((n) => n.type === "follow"),
    ratings: filteredNotifications.filter((n) => n.type === "rating"),
    suggestions: filteredNotifications.filter((n) => n.type === "ai_suggestion"),
    invites: filteredNotifications.filter((n) => n.type === "invite"),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-text-primary">Notifications</h2>
        {unreadCount > 0 && (
          <motion.button
            onClick={handleMarkAllAsRead}
            whileHover={{ scale: 1.02 }}
            className="px-3 py-1 rounded-lg text-sm bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          >
            Mark all as read
          </motion.button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => {
            setFilter("all");
            loadNotifications(1);
          }}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            filter === "all"
              ? "bg-accent text-background"
              : "bg-border text-text-secondary hover:bg-border/80"
          )}
        >
          All
        </button>
        <button
          onClick={() => {
            setFilter("unread");
            loadNotifications(1);
          }}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            filter === "unread"
              ? "bg-accent text-background"
              : "bg-border text-text-secondary hover:bg-border/80"
          )}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notifications */}
      {loading && page === 1 ? (
        <div className="text-center py-12">
          <div className="inline-block animate-pulse">
            <div className="w-12 h-12 rounded-full bg-border" />
          </div>
        </div>
      ) : filteredNotifications.length > 0 ? (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {Object.entries(groupedByType).map(([key, items]) =>
              items.length > 0 ? (
                <motion.div key={key} className="space-y-2">
                  <h3 className="text-xs font-semibold text-text-muted uppercase px-2">
                    {key}
                  </h3>
                  {items.map((notif) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      whileHover={{ x: 4 }}
                      onClick={() => handleNotificationClick(notif)}
                      className={cn(
                        "glass-card p-4 cursor-pointer transition-all hover:shadow-card-hover",
                        !notif.is_read && "border-l-2 border-accent"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {notif.actor_avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={notif.actor_avatar_url}
                            alt={notif.actor_username}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-clout/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-clout">
                            {(notif.actor_username?.[0] ?? "?").toUpperCase()}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <span className={cn("text-lg flex-shrink-0", colors[notif.type])}>
                              {icons[notif.type]}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-text-primary line-clamp-2">
                                <strong>{notif.actor_display_name ?? notif.actor_username}</strong>{" "}
                                {notif.message}
                              </p>
                              <p className="text-xs text-text-muted mt-1">
                                {timeAgo(notif.timestamp)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {!notif.is_read && (
                          <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />
                        )}

                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notif.id);
                          }}
                          whileHover={{ scale: 1.1 }}
                          className="text-text-muted hover:text-danger transition-colors text-sm flex-shrink-0"
                        >
                          ✕
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : null
            )}
          </AnimatePresence>

          {/* Load More */}
          {hasMore && (
            <motion.button
              onClick={() => loadNotifications(page + 1)}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              className="w-full py-3 rounded-lg border border-border hover:bg-surface transition-colors disabled:opacity-50 mt-4"
            >
              {loading ? "Loading..." : "Load More"}
            </motion.button>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-text-muted">No notifications yet</p>
        </div>
      )}
    </motion.div>
  );
}
