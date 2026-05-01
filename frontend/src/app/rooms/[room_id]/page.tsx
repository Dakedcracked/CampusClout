"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import RoomHeader from "@/components/rooms/RoomHeader";
import RoomChat from "@/components/rooms/RoomChat";
import MemberList from "@/components/rooms/MemberList";

interface Room {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
  creator_username: string;
  member_count: number;
  is_public: boolean;
}

export default function RoomDetailPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.room_id as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [userRes, roomRes] = await Promise.all([
          fetch("/api/v1/auth/me", { credentials: "include" }),
          fetch(`/api/v1/rooms/${roomId}`, { credentials: "include" }),
        ]);

        if (!userRes.ok) {
          router.push("/login");
          return;
        }

        setUser(await userRes.json());

        if (!roomRes.ok) {
          setError("Room not found");
          return;
        }

        const roomData = await roomRes.json();
        setRoom(roomData);
        setOnlineCount(roomData.online_count || 0);
      } catch (err) {
        setError("Failed to load room");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [roomId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-neon-purple border-t-transparent animate-spin" />
        <div className="gradient-text font-mono font-bold">Loading…</div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-text-muted">{error || "Room not found"}</div>
        <button
          onClick={() => router.push("/rooms")}
          className="btn-primary text-xs"
        >
          Back to Rooms
        </button>
      </div>
    );
  }

  const isCreator = user?.id === room.creator_id;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/rooms")}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              ←
            </button>
            <span className="text-lg font-bold gradient-text tracking-tight truncate">
              {room.name}
            </span>
          </div>

          <button
            onClick={() => router.push("/rooms")}
            className="btn-ghost text-xs"
          >
            All Rooms
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Room Header */}
        <RoomHeader
          roomId={room.id}
          roomName={room.name}
          roomDescription={room.description}
          memberCount={room.member_count}
          onlineCount={onlineCount}
          creatorUsername={room.creator_username}
          isCreator={isCreator}
          onShowMembers={() => setShowMembers(!showMembers)}
        />

        {/* Chat & Members Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3">
            {user && (
              <RoomChat
                roomId={room.id}
                userId={user.id}
                username={user.username}
              />
            )}
          </div>

          <div className="md:col-span-1">
            {showMembers ? (
              <MemberList roomId={room.id} />
            ) : (
              <div className="glass-card rounded-lg p-4 border border-border text-center text-sm text-text-muted">
                <p>👥 Click &ldquo;Members&rdquo; to see online users</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
