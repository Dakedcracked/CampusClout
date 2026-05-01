"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

interface NotificationBadgeProps {
  unreadCount: number;
  onMarkAllAsRead?: () => void;
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
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  if (secs < 2592000) return `${Math.floor(secs / 86400)}d`;
  return `${Math.floor(secs / 2592000)}mo`;
}

export default function NotificationBadge({
  unreadCount,
  onMarkAllAsRead,
}: NotificationBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    if (!isOpen && notifications.length === 0) {
      setLoading(true);
      try {
        const res = await fetch("/api/v1/notifications?limit=5", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
        }
      } finally {
        setLoading(false);
      }
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <motion.button
        onClick={handleOpen}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="relative p-2 rounded-lg hover:bg-surface transition-colors"
        aria-label="Notifications"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-0 right-0 w-5 h-5 rounded-full bg-danger flex items-center justify-center text-xs font-bold text-white"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40"
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute top-full right-0 mt-2 w-80 glass-card z-50 max-h-96 overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 p-4 border-b border-border bg-background/50 backdrop-blur flex items-center justify-between">
                <h3 className="font-semibold text-text-primary">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllAsRead}
                    className="text-xs text-accent hover:text-accent-hover transition-colors"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {/* Notifications */}
              {loading ? (
                <div className="p-4 text-center text-text-muted">
                  Loading...
                </div>
              ) : notifications.length > 0 ? (
                <div className="space-y-0">
                  {notifications.map((notif) => (
                    <motion.button
                      key={notif.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ x: 4 }}
                      className={cn(
                        "w-full p-4 border-b border-border hover:bg-surface/50 transition-colors text-left",
                        !notif.is_read && "bg-clout/5"
                      )}
                    >
                      <div className="flex gap-3">
                        {notif.actor_avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={notif.actor_avatar_url}
                            alt={notif.actor_username}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-clout/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-clout">
                            {(notif.actor_username?.[0] ?? "?").toUpperCase()}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <span className={cn("text-lg", colors[notif.type])}>
                              {icons[notif.type]}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-text-primary">
                                {notif.message}
                              </p>
                              <p className="text-xs text-text-muted mt-1">
                                {timeAgo(notif.timestamp)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {!notif.is_read && (
                          <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-text-muted">
                  No notifications yet
                </div>
              )}

              {/* Footer */}
              <div className="p-3 border-t border-border text-center">
                <a
                  href="/notifications"
                  className="text-xs text-accent hover:text-accent-hover transition-colors font-medium"
                >
                  View all notifications →
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
