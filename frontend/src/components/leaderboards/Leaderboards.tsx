"use client";

import { useState } from "react";
import RisingStars from "./RisingStars";
import MostInvested from "./MostInvested";
import Hottest from "./Hottest";
import ContentKings from "./ContentKings";
import StoreMVP from "./StoreMVP";

type LeaderboardType = "rising-stars" | "most-invested" | "hottest" | "content-kings" | "store-mvp";

const LEADERBOARDS: Array<{
  id: LeaderboardType;
  label: string;
  icon: string;
}> = [
  { id: "rising-stars", label: "Rising Stars", icon: "🚀" },
  { id: "most-invested", label: "Most Invested", icon: "💰" },
  { id: "hottest", label: "Hottest", icon: "🔥" },
  { id: "content-kings", label: "Content Kings", icon: "👑" },
  { id: "store-mvp", label: "Store MVP", icon: "🏪" },
];

export default function Leaderboards() {
  const [activeLeaderboard, setActiveLeaderboard] = useState<LeaderboardType>("rising-stars");

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="sticky top-0 z-20 bg-[#0a0a0a] border-b border-[#222] backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {LEADERBOARDS.map((lb) => (
              <button
                key={lb.id}
                onClick={() => setActiveLeaderboard(lb.id)}
                className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 ${
                  activeLeaderboard === lb.id
                    ? "bg-[#9d4edd] text-white"
                    : "bg-[#1a1a1a] text-[#888] hover:text-white hover:bg-[#222]"
                }`}
              >
                {lb.icon} {lb.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-8">
        {activeLeaderboard === "rising-stars" && <RisingStars />}
        {activeLeaderboard === "most-invested" && <MostInvested />}
        {activeLeaderboard === "hottest" && <Hottest />}
        {activeLeaderboard === "content-kings" && <ContentKings />}
        {activeLeaderboard === "store-mvp" && <StoreMVP />}
      </div>
    </div>
  );
}
