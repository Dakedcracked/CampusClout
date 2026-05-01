"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface HotProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  hot_score: number;
  hot_rank_position: number;
  beauty_score: number;
  engagement_level: "high" | "medium" | "low";
}

interface ScoreBreakdown {
  hot_score: number;
  beauty_score: number;
  engagement_score: number;
  velocity_score: number;
  quality_score: number;
  components: {
    [key: string]: { weight: number; score: number };
  };
}

export default function HotProfiles() {
  const [profiles, setProfiles] = useState<HotProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null);

  useEffect(() => {
    fetchTopProfiles();
  }, []);

  async function fetchTopProfiles() {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/hot-profiles/top?limit=20", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles);
      } else {
        setError("Failed to load hot profiles");
      }
    } catch {
      setError("Error fetching profiles");
    } finally {
      setLoading(false);
    }
  }

  async function fetchBreakdown(username: string) {
    try {
      const res = await fetch(`/api/v1/hot-profiles/${username}/breakdown`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setBreakdown(data);
      }
    } catch (e) {
      console.error("Error fetching breakdown:", e);
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-surface-raised rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-sm">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-text-muted mb-4">
        Ranked by AI beauty analysis + engagement + growth velocity + profile quality
      </div>

      <div className="space-y-3">
        {profiles.map((profile, idx) => (
          <motion.div
            key={profile.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => {
              setSelectedProfile(profile.username);
              fetchBreakdown(profile.username);
            }}
            className="border border-border rounded-lg p-4 hover:bg-surface-raised cursor-pointer transition-colors"
          >
            <div className="flex items-start gap-4">
              {/* Rank Badge */}
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="font-bold text-accent text-lg">
                  #{profile.hot_rank_position}
                </span>
              </div>

              {/* Avatar & Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-text-primary">
                    {profile.display_name || `@${profile.username}`}
                  </span>
                  {profile.hot_score >= 80 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/30 text-red-400">
                      🔥 HOT
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted mb-2">
                  @{profile.username} · {profile.follower_count.toLocaleString()} followers
                </div>
                {profile.bio && (
                  <p className="text-xs text-text-secondary line-clamp-2">
                    {profile.bio}
                  </p>
                )}
              </div>

              {/* Hot Score */}
              <div className="flex-shrink-0 text-right">
                <div className={`text-2xl font-bold ${getScoreColor(profile.hot_score)}`}>
                  {profile.hot_score.toFixed(0)}
                </div>
                <div className="text-xs text-text-muted mt-1">HOT SCORE</div>
                <div className="text-xs mt-2 px-2 py-1 rounded bg-surface rounded-full">
                  {profile.engagement_level}
                </div>
              </div>
            </div>

            {/* Score Components Bar */}
            <div className="flex gap-2 mt-4">
              <div className="flex-1 h-2 bg-surface-raised rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-500"
                  style={{
                    width: `${profile.beauty_score}%`,
                  }}
                />
              </div>
              <span className="text-xs text-text-muted whitespace-nowrap">
                {profile.beauty_score.toFixed(0)}% beauty
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Breakdown Modal */}
      {selectedProfile && breakdown && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedProfile(null)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-surface-raised rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-lg mb-4">Score Breakdown</h2>

            {/* Main Score */}
            <div className="mb-6 p-4 rounded-lg bg-surface border border-border">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getScoreColor(breakdown.hot_score)}`}>
                  {breakdown.hot_score.toFixed(1)}
                </div>
                <div className="text-sm text-text-muted mt-2">OVERALL HOT SCORE</div>
              </div>
            </div>

            {/* Component Breakdown */}
            <div className="space-y-4">
              {[
                { key: "beauty", label: "Beauty Score", color: "from-pink-500" },
                {
                  key: "engagement",
                  label: "Engagement Power",
                  color: "from-green-500",
                },
                { key: "velocity", label: "Growth Velocity", color: "from-blue-500" },
                { key: "quality", label: "Profile Quality", color: "from-purple-500" },
              ].map((comp) => (
                <div key={comp.key}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">{comp.label}</span>
                    <span className="text-sm font-bold">
                      {Math.round(breakdown[`${comp.key}_score` as keyof ScoreBreakdown] as number)}/100
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 h-3 bg-surface rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${comp.color} to-transparent`}
                        style={{
                          width: `${breakdown[`${comp.key}_score` as keyof ScoreBreakdown] || 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-text-muted w-8">
                      {(breakdown.components[comp.key]?.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedProfile(null)}
              className="w-full mt-6 px-4 py-2 bg-accent text-black rounded-lg font-medium hover:bg-accent/90 transition-colors"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
