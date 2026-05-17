"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Room {
  id: string;
  name: string;
  creator_username: string;
  member_count: number;
  is_suspended: boolean;
  created_at: string;
}

export default function RoomsTab() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"active" | "suspended" | "all">("all");
  const [page, setPage] = useState(1);

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadRooms();
  }, [filter, page, search]);

  async function loadRooms() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        skip: String((page - 1) * ITEMS_PER_PAGE),
      });

      if (search) params.append("search", search);
      if (filter !== "all") params.append("is_suspended", filter === "suspended" ? "true" : "false");

      const res = await fetch(`/api/v1/admin/rooms?${params}`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setRooms(Array.isArray(data) ? data : data.rooms || []);
      }
    } catch (err) {
      console.error("Failed to load rooms:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateRoomStatus(roomId: string, isSuspended: boolean) {
    try {
      const res = await fetch(`/api/v1/admin/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_suspended: isSuspended }),
      });

      if (res.ok) {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === roomId ? { ...r, is_suspended: isSuspended } : r
          )
        );
      }
    } catch (err) {
      console.error("Failed to update room:", err);
    }
  }

  async function deleteRoom(roomId: string) {
    if (!confirm("Delete this room permanently?")) return;

    try {
      const res = await fetch(`/api/v1/admin/rooms/${roomId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
      }
    } catch (err) {
      console.error("Failed to delete room:", err);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search rooms…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 px-4 py-2 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-neon-purple/50"
        />

        <div className="flex items-center gap-2">
          {(["all", "active", "suspended"] as const).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                filter === f
                  ? "bg-neon-purple text-white"
                  : "bg-surface text-text-secondary"
              }`}
            >
              {f === "all"
                ? "All"
                : f === "active"
                  ? "Active"
                  : "Suspended"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="text-left px-4 py-3 font-semibold">Room Name</th>
              <th className="text-left px-4 py-3 font-semibold">Creator</th>
              <th className="text-left px-4 py-3 font-semibold">Members</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : rooms.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-text-muted">
                  No rooms found
                </td>
              </tr>
            ) : (
              rooms.map((room) => (
                <motion.tr
                  key={room.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-border/50 hover:bg-surface/50 transition-colors"
                >
                  <td className="px-4 py-3 font-semibold text-text-primary">
                    {room.name}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    @{room.creator_username}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    👥 {room.member_count}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded font-semibold ${
                        room.is_suspended
                          ? "bg-red-500/20 text-red-300"
                          : "bg-green-500/20 text-green-300"
                      }`}
                    >
                      {room.is_suspended ? "Suspended" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    {room.is_suspended ? (
                      <button
                        onClick={() => updateRoomStatus(room.id, false)}
                        className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-all"
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => updateRoomStatus(room.id, true)}
                        className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-all"
                      >
                        Suspend
                      </button>
                    )}

                    <button
                      onClick={() => deleteRoom(room.id)}
                      className="px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all"
                    >
                      Delete
                    </button>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rooms.length > 0 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-xs disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-text-muted">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={rooms.length < ITEMS_PER_PAGE}
            className="btn-secondary text-xs disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
