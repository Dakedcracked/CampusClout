"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import RoomCard, { type Room } from "./RoomCard";
import CreateRoomModal from "./CreateRoomModal";
import JoinRoomModal from "./JoinRoomModal";

type FilterType = "all" | "public" | "private" | "my-rooms";

export default function RoomList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [myRoomIds, setMyRoomIds] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRoomForJoin, setSelectedRoomForJoin] = useState<Room | null>(
    null
  );
  const [showJoinModal, setShowJoinModal] = useState(false);

  const ITEMS_PER_PAGE = 12;

  async function loadRooms() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        skip: String((page - 1) * ITEMS_PER_PAGE),
      });

      if (searchQuery) {
        params.append("search", searchQuery);
      }

      if (filter === "public") {
        params.append("is_public", "true");
      } else if (filter === "private") {
        params.append("is_public", "false");
      } else if (filter === "my-rooms") {
        params.append("my_rooms", "true");
      }

      const res = await fetch(`/api/v1/rooms?${params}`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        const newRooms = Array.isArray(data) ? data : data.rooms || [];
        setRooms((prev) => (page === 1 ? newRooms : [...prev, ...newRooms]));
        setHasMore(newRooms.length === ITEMS_PER_PAGE);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadMyRooms() {
    try {
      const res = await fetch("/api/v1/rooms/my-memberships", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const membershipIds = new Set<string>(
          (Array.isArray(data) ? data : data.rooms || []).map(
            (r: Room) => r.id
          )
        );
        setMyRoomIds(membershipIds);
      }
    } catch (error) {
      console.error("Failed to load memberships:", error);
    }
  }

  useEffect(() => {
    loadMyRooms();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filter]);

  useEffect(() => {
    loadRooms();
  }, [page, searchQuery, filter]);

  const handleJoinRoom = (room: Room) => {
    setSelectedRoomForJoin(room);
    setShowJoinModal(true);
  };

  const handleRoomCreated = (newRoom: Room) => {
    setRooms((prev) => [newRoom, ...prev]);
    setMyRoomIds((prev) => new Set([...prev, newRoom.id]));
    setShowCreateModal(false);
  };

  const handleJoinSuccess = (roomId: string) => {
    setMyRoomIds((prev) => new Set([...prev, roomId]));
    setShowJoinModal(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-text-primary">
            Discover Rooms
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary text-xs whitespace-nowrap"
          >
            + Create Room
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search rooms..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-neon-purple/50 transition-all"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "public", "private", "my-rooms"] as FilterType[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f
                  ? "bg-neon-purple text-white"
                  : "bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-raised"
              }`}
            >
              {f === "all"
                ? "All Rooms"
                : f === "public"
                  ? "Public"
                  : f === "private"
                    ? "Private"
                    : "My Rooms"}
            </button>
          )
        )}
      </div>

      {/* Room Grid */}
      {loading && page === 1 ? (
        <div className="grid md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="glass-card h-48 rounded-lg animate-pulse bg-surface"
            />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p className="mb-2">No rooms found.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-neon-purple hover:underline text-sm"
          >
            Create one to get started!
          </button>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            {rooms.map((room, index) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <RoomCard
                  room={room}
                  isMember={myRoomIds.has(room.id)}
                  onJoinClick={handleJoinRoom}
                />
              </motion.div>
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="btn-secondary text-xs"
              >
                {loading ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleRoomCreated}
        />
      )}

      {showJoinModal && selectedRoomForJoin && (
        <JoinRoomModal
          room={selectedRoomForJoin}
          onClose={() => setShowJoinModal(false)}
          onJoinSuccess={() => handleJoinSuccess(selectedRoomForJoin.id)}
        />
      )}
    </div>
  );
}
