"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface MatchSuggestion {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  similarity_score: number;
  market_cap: number;
}

export default function MatchesPage() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [greenLightStatus, setGreenLightStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadMatches() {
      try {
        const res = await fetch("/api/v1/matches/suggestions", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
        } else if (res.status === 401) {
          router.push("/login");
        } else {
          setError("Failed to load AI matches");
        }
      } catch (err) {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    loadMatches();
  }, [router]);

  async function handleGreenLight(userId: string) {
    try {
      const res = await fetch(`/api/v1/matches/${userId}/green-light`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setGreenLightStatus((prev) => ({
          ...prev,
          [userId]: data.message,
        }));
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 pt-8 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black gradient-text">AI Matchmaker</h1>
          <p className="text-text-muted mt-1">Vector-based matching across your university</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="glass-card h-48 animate-pulse bg-surface" />
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-20 glass-card">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-text-primary">No Matches Yet</h2>
          <p className="text-text-muted mt-2">Update your bio to get better vector embeddings!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {suggestions.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6 flex flex-col hover:border-accent/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <Link href={`/profile/${user.username}`}>
                    <div className="w-20 h-20 rounded-full border-2 border-accent/20 overflow-hidden bg-surface hover:opacity-80 transition-opacity flex-shrink-0 cursor-pointer">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl font-black bg-gradient-to-br from-neon-purple to-neon-pink text-white">
                          {(user.display_name ?? user.username)[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${user.username}`} className="block hover:underline">
                      <h2 className="text-xl font-bold text-text-primary truncate">
                        {user.display_name ?? `@${user.username}`}
                      </h2>
                      <p className="text-sm text-text-muted truncate">@{user.username}</p>
                    </Link>
                    
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs font-mono font-medium text-neon-green bg-neon-green/10 px-2 py-1 rounded-full">
                        {Math.round(user.similarity_score * 100)}% Match
                      </span>
                      <span className="text-xs font-mono font-medium text-accent">
                        ◈ {user.market_cap.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border flex flex-col gap-3">
                  <button
                    onClick={() => handleGreenLight(user.id)}
                    className="w-full py-2.5 rounded-lg bg-accent text-white font-bold hover:bg-accent-hover transition-colors shadow-[0_0_15px_rgba(244,114,182,0.3)]"
                  >
                    🟢 Green-Light
                  </button>
                  
                  {greenLightStatus[user.id] && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="text-xs text-center text-neon-green font-medium"
                    >
                      {greenLightStatus[user.id]}
                    </motion.p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
