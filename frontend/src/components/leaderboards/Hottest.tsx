"use client";

import LeaderboardTable from "./LeaderboardTable";

export default function Hottest() {
  return (
    <LeaderboardTable
      metric="hottest"
      title="🔥 Hottest"
      description="Most attractive profiles by community votes (50+ votes minimum)"
      columns={[
        {
          key: "hot_ratio",
          label: "Hot %",
          format: (v) => {
            if (typeof v === "number") return `${(v * 100).toFixed(1)}%`;
            return String(v) ?? "—";
          },
        },
        {
          key: "composite_score",
          label: "Score",
          format: (v) => {
            if (typeof v === "number") return v.toFixed(1);
            return String(v) ?? "—";
          },
        },
      ]}
    />
  );
}
