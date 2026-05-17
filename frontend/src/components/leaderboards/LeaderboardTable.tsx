"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  market_cap?: number;
  hot_ratio?: number;
  engagement_velocity?: number;
  trending_rank?: number;
  composite_score?: number;
  sales_volume?: number;
}

interface LeaderboardTableProps {
  metric: "rising-stars" | "most-invested" | "hottest" | "content-kings" | "store-mvp";
  title: string;
  description: string;
  columns: Array<{
    key: keyof LeaderboardEntry;
    label: string;
    format?: (value: number | string | null | undefined) => string;
  }>;
}

const colors = ["#9d4edd", "#f472b6", "#60a5fa", "#00e5a0", "#fbbf24"];

function Avatar({ user }: { user: LeaderboardEntry }) {
  const color = colors[user.username.charCodeAt(0) % colors.length];
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.username}
        className="w-10 h-10 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
    >
      {((user.display_name ?? user.username)?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

function getRankMedal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export default function LeaderboardTable({
  metric,
  title,
  description,
  columns,
}: LeaderboardTableProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `${API}/api/v1/leaderboards/${metric}?limit=${limit}&offset=${page * limit}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          throw new Error(`Failed to fetch leaderboard: ${res.statusText}`);
        }
        const data = await res.json();
        setEntries(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [metric, page]);

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-black gradient-text mb-2">{title}</h1>
        <p className="text-[#888] text-lg">{description}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-[#9d4edd] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-4">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-[#666]">
          <p>No entries yet. Be the first to lead this leaderboard!</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-[#222] bg-[#0f0f0f]">
            <table className="w-full text-sm">
              <thead className="border-b border-[#222]">
                <tr className="bg-[#151515]">
                  <th className="px-6 py-4 text-left font-bold text-[#999]">Rank</th>
                  <th className="px-6 py-4 text-left font-bold text-[#999]">User</th>
                  {columns.map((col) => (
                    <th key={col.key as string} className="px-6 py-4 text-left font-bold text-[#999]">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const rank = page * limit + idx + 1;
                  return (
                    <tr key={entry.user_id} className="border-b border-[#111] hover:bg-[#111] transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold">{getRankMedal(rank)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/profile/${entry.username}`}>
                          <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                            <Avatar user={entry} />
                            <div>
                              <p className="font-semibold text-white">
                                {entry.display_name || entry.username}
                              </p>
                              <p className="text-xs text-[#666]">@{entry.username}</p>
                            </div>
                          </div>
                        </Link>
                      </td>
                      {columns.map((col) => {
                        const value = (entry as unknown as Record<string, unknown>)[col.key];
                        return (
                          <td key={col.key} className="px-6 py-4 text-[#aaa]">
                            {col.format
                              ? col.format(value as number | string | null | undefined)
                              : String(value ?? "—")}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] text-white font-semibold hover:bg-[#222] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <span className="text-[#666]">
              Page {page + 1} {entries.length === limit && "..."}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={entries.length < limit}
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] text-white font-semibold hover:bg-[#222] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
