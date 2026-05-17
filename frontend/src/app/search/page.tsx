"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import GlobalSearch from "@/components/search/GlobalSearch";
import SearchResultCard from "@/components/search/SearchResultCard";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface SearchResult {
  id: string;
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string | null;
  market_cap?: number;
  follower_count?: number;
  content?: string;
  author_username?: string;
  like_count?: number;
  comment_count?: number;
  name?: string;
  description?: string;
  member_count?: number;
  type: "user" | "post" | "room";
}

type TabType = "all" | "users" | "posts" | "rooms";

function SearchPageContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [timing, setTiming] = useState<number>(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (query) {
      search(query, 0);
    }
  }, [query]);

  const search = async (q: string, skip: number) => {
    if (!q.trim()) return;

    setLoading(true);
    const startTime = Date.now();

    try {
      const res = await fetch(
      `${API}/api/v1/search/global?q=${encodeURIComponent(q)}&skip=${skip}&limit=20`,
      );

      if (res.ok) {
        const data = await res.json();
        setTiming(Date.now() - startTime);
        setResults(skip === 0 ? data.results : [...results, ...data.results]);
        setHasMore((data.results?.length ?? 0) >= 20);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    search(query, (nextPage - 1) * 20);
  };

  const filteredResults = results.filter((r) => {
    if (activeTab === "all") return true;
    return r.type === activeTab.slice(0, -1);
  });

  const tabs: { label: string; value: TabType; count: number }[] = [
    { label: "All", value: "all", count: results.length },
    {
      label: "Users",
      value: "users",
      count: results.filter((r) => r.type === "user").length,
    },
    {
      label: "Posts",
      value: "posts",
      count: results.filter((r) => r.type === "post").length,
    },
    {
      label: "Rooms",
      value: "rooms",
      count: results.filter((r) => r.type === "room").length,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background"
    >
      <div className="max-w-2xl mx-auto p-4 pt-20">
        {/* Search Bar */}
        <div className="mb-8">
          <GlobalSearch />
        </div>

        {query ? (
          <>
            {/* Results Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-text-primary mb-1">
                Search results for &quot;{query}&quot;
              </h1>
              <p className="text-sm text-text-muted">
                Found {results.length} results in {timing}ms
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border mb-6 -mx-4 px-4">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setActiveTab(tab.value);
                    setPage(1);
                  }}
                  className={cn(
                    "px-4 py-3 font-medium text-sm transition-colors border-b-2",
                    activeTab === tab.value
                      ? "text-accent border-accent"
                      : "text-text-muted border-transparent hover:text-text-secondary"
                  )}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-2 text-xs text-text-muted">
                      ({tab.count})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Results Grid */}
            {filteredResults.length > 0 ? (
              <div className="space-y-3 mb-8">
                {filteredResults.map((result) => (
                  <SearchResultCard
                    key={`${result.type}-${result.id}`}
                    type={result.type as "user" | "post" | "room"}
                    data={result as unknown as Record<string, unknown>}
                    onFollow={() => {
                      // Handle follow
                    }}
                    onJoin={() => {
                      // Handle join
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-text-muted">
                  No {activeTab === "all" ? "" : activeTab} results found
                </p>
              </div>
            )}

            {/* Load More */}
            {hasMore && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={handleLoadMore}
                disabled={loading}
                className="w-full py-3 rounded-lg border border-border hover:bg-surface transition-colors text-center font-medium disabled:opacity-50"
              >
                {loading ? "Loading..." : "Load More Results"}
              </motion.button>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-text-muted text-lg">
              Enter a search query to get started
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SearchPageContent />
    </Suspense>
  );
}
