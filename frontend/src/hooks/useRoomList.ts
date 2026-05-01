"use client";

import { useState, useCallback, useEffect } from "react";

export interface Room {
  id: string;
  name: string;
  description?: string;
  creator_id: string;
  member_count: number;
  is_active: boolean;
  is_password_protected: boolean;
  created_at: string;
}

export function useRoomList(filter: "all" | "public" | "private" | "my" = "all") {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchRooms = useCallback(
    async (skip: number = 0, limit: number = 20) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          skip: skip.toString(),
          limit: limit.toString(),
        });

        if (filter !== "all") {
          params.append("filter", filter);
        }

        const res = await fetch(
          `/api/v1/rooms/?${params.toString()}`,
          {
            credentials: "include",
          }
        );

        if (!res.ok) throw new Error("Failed to fetch rooms");

        const data = await res.json();
        setRooms(data.rooms || []);
        setHasMore((data.rooms?.length || 0) >= limit);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      } finally {
        setLoading(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    fetchRooms(0, 20);
  }, [fetchRooms]);

  const loadMore = useCallback(
    (skip: number) => {
      fetchRooms(skip, 20);
    },
    [fetchRooms]
  );

  return {
    rooms,
    loading,
    error,
    hasMore,
    fetchRooms,
    loadMore,
  };
}
