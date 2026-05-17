"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

type FilterTab = "all" | "users" | "posts" | "rooms";

interface UserResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  rating_score?: number;
}

interface PostResult {
  id: string;
  author_id: string;
  author_username: string;
  content: string;
  like_count: number;
  created_at: string;
}

interface RoomResult {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
  member_count: number;
  created_at: string;
}

interface SearchItem {
  type: "user" | "post" | "room";
  data: UserResult | PostResult | RoomResult;
}

interface SearchResponse {
  results: SearchItem[];
  total: number;
}

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "users", label: "People" },
  { id: "posts", label: "Posts" },
  { id: "rooms", label: "Rooms" },
];

const ENDPOINT_MAP: Record<FilterTab, string> = {
  all: "/api/v1/search/global",
  users: "/api/v1/search/users",
  posts: "/api/v1/search/posts",
  rooms: "/api/v1/search/rooms",
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (q: string, tab: FilterTab) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const endpoint = ENDPOINT_MAP[tab];
      const res = await fetch(
        `${endpoint}?q=${encodeURIComponent(q)}&limit=30`,
        { credentials: "include", signal: abortRef.current.signal }
      );

      if (res.ok) {
        const data: SearchResponse = await res.json();
        setResults(data.results ?? []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 1) {
        search(query, filter);
      } else {
        setResults([]);
        setSearched(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, filter, search]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const users = results.filter((r) => r.type === "user").map((r) => r.data as UserResult);
  const posts = results.filter((r) => r.type === "post").map((r) => r.data as PostResult);
  const rooms = results.filter((r) => r.type === "room").map((r) => r.data as RoomResult);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">
      {/* Search input */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555] text-lg select-none">🔍</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people, posts, rooms…"
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#111] border border-[#222] text-text-primary placeholder-[#555] text-sm focus:outline-none focus:border-[#444] transition-colors"
        />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] text-xs animate-pulse">
            Searching…
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === tab.id
                ? "bg-white text-black"
                : "bg-[#1a1a1a] text-[#888] hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {!query.trim() ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 text-[#555]"
          >
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-lg font-medium text-[#777]">Search CampusClout</p>
            <p className="text-sm mt-1">Find people, posts, and rooms</p>
          </motion.div>
        ) : loading && !searched ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-[#111] animate-pulse" />
            ))}
          </motion.div>
        ) : searched && results.length === 0 ? (
          <motion.div
            key="no-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 text-[#555]"
          >
            <div className="text-4xl mb-3">😕</div>
            <p className="font-medium text-[#777]">No results for &ldquo;{query}&rdquo;</p>
            <p className="text-sm mt-1">Try different keywords</p>
          </motion.div>
        ) : (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-1">
            {/* Users */}
            {users.length > 0 && (
              <>
                {(filter === "all") && (
                  <p className="text-xs font-semibold text-[#555] uppercase tracking-wider px-1 mt-2 mb-1">People</p>
                )}
                {users.map((u, i) => (
                  <motion.button
                    key={u.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => router.push(`/profile/${u.username}`)}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#111] transition-colors text-left w-full"
                  >
                    {u.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatar_url} alt={u.username} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center flex-shrink-0 font-bold text-white text-sm">
                        {(u.username?.[0] ?? "?").toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">
                        {u.display_name || u.username}
                      </p>
                      <p className="text-xs text-[#666] truncate">
                        @{u.username}
                        {u.follower_count > 0 && ` · ${u.follower_count.toLocaleString()} followers`}
                      </p>
                      {u.bio && (
                        <p className="text-xs text-[#888] truncate mt-0.5">{u.bio}</p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-[#444] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </motion.button>
                ))}
              </>
            )}

            {/* Posts */}
            {posts.length > 0 && (
              <>
                {filter === "all" && (
                  <p className="text-xs font-semibold text-[#555] uppercase tracking-wider px-1 mt-3 mb-1">Posts</p>
                )}
                {posts.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (users.length + i) * 0.03 }}
                    className="p-3 rounded-xl hover:bg-[#111] transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-400 flex items-center justify-center font-bold text-white text-xs flex-shrink-0">
                        {(p.author_username?.[0] ?? "?").toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-[#888]">@{p.author_username}</span>
                      <span className="text-xs text-[#555]">·</span>
                      <span className="text-xs text-[#555]">{timeAgo(p.created_at)}</span>
                    </div>
                    <p className="text-sm text-white line-clamp-3 pl-9">{p.content}</p>
                    <div className="flex gap-3 mt-2 pl-9 text-xs text-[#555]">
                      <span>♡ {p.like_count.toLocaleString()}</span>
                    </div>
                  </motion.div>
                ))}
              </>
            )}

            {/* Rooms */}
            {rooms.length > 0 && (
              <>
                {filter === "all" && (
                  <p className="text-xs font-semibold text-[#555] uppercase tracking-wider px-1 mt-3 mb-1">Rooms</p>
                )}
                {rooms.map((r, i) => (
                  <motion.button
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (users.length + posts.length + i) * 0.03 }}
                    onClick={() => router.push(`/rooms/${r.id}`)}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#111] transition-colors text-left w-full"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-700 to-purple-400 flex items-center justify-center flex-shrink-0 font-bold text-white text-base">
                      #
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{r.name}</p>
                      {r.description && (
                        <p className="text-xs text-[#666] truncate">{r.description}</p>
                      )}
                      <p className="text-xs text-[#555] mt-0.5">{r.member_count.toLocaleString()} members</p>
                    </div>
                    <svg className="w-4 h-4 text-[#444] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </motion.button>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
