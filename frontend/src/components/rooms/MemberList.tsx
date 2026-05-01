"use client";

import { useState, useEffect } from "react";

interface RoomMember {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
}

interface MemberListProps {
  roomId: string;
}

export default function MemberList({ roomId }: MemberListProps) {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMembers() {
      try {
        const res = await fetch(`/api/v1/rooms/${roomId}/members`, {
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          setMembers(Array.isArray(data) ? data : data.members || []);
        }
      } catch (err) {
        console.error("Failed to load members:", err);
      } finally {
        setLoading(false);
      }
    }

    loadMembers();

    // Refresh members periodically
    const interval = setInterval(loadMembers, 10000);
    return () => clearInterval(interval);
  }, [roomId]);

  const onlineMembers = members.filter((m) => m.is_online);
  const offlineMembers = members.filter((m) => !m.is_online);

  return (
    <div className="glass-card rounded-lg p-4 border border-border h-full overflow-y-auto">
      <h3 className="font-semibold text-text-primary mb-4">
        Members ({members.length})
      </h3>

      {loading ? (
        <div className="text-xs text-text-muted text-center py-4 animate-pulse">
          Loading…
        </div>
      ) : members.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-4">
          No members yet
        </p>
      ) : (
        <div className="space-y-3">
          {/* Online Members */}
          {onlineMembers.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-text-muted uppercase mb-2">
                Online ({onlineMembers.length})
              </p>
              <div className="space-y-2">
                {onlineMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-2 p-2 hover:bg-surface rounded-lg transition-colors"
                  >
                    <div className="relative flex-shrink-0">
                      {member.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.avatar_url}
                          alt={member.username}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-neon-purple/30 flex items-center justify-center text-xs font-bold">
                          {(member.username?.[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-neon-green rounded-full border border-background" />
                    </div>

                    <span className="text-xs text-text-secondary truncate flex-1">
                      {member.username}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offline Members */}
          {offlineMembers.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-text-muted uppercase mb-2">
                Offline ({offlineMembers.length})
              </p>
              <div className="space-y-2 opacity-60">
                {offlineMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-2 p-2 hover:bg-surface rounded-lg transition-colors"
                  >
                    {member.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.avatar_url}
                        alt={member.username}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-neon-purple/30 flex items-center justify-center text-xs font-bold">
                        {member.username[0].toUpperCase()}
                      </div>
                    )}

                    <span className="text-xs text-text-secondary truncate flex-1">
                      {member.username}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
