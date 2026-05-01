"use client";

import { useState, useCallback, useEffect } from "react";

export interface SearchResult {
  type: "user" | "post" | "room";
  data: Record<string, unknown>;
}

export function useSearch(initialQuery: string = "") {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/v1/search/global?q=${encodeURIComponent(q)}&limit=20`,
          {
            credentials: "include",
          }
        );

        if (!res.ok) {
          throw new Error("Search failed");
        }

        const data = await res.json();
        setResults(data.results || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Search error");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) {
        search(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, search]);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    search,
  };
}
