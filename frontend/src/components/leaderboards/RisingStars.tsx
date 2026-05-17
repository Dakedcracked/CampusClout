"use client";

import LeaderboardTable from "./LeaderboardTable";

export default function RisingStars() {
  return (
    <LeaderboardTable
      metric="rising-stars"
      title="🚀 Rising Stars"
      description="Fastest growing profiles this week"
      columns={[
        {
          key: "engagement_velocity",
          label: "Growth",
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

