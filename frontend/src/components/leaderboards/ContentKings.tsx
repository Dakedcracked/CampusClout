"use client";

import LeaderboardTable from "./LeaderboardTable";

export default function ContentKings() {
  return (
    <LeaderboardTable
      metric="content-kings"
      title="👑 Content Kings"
      description="Top creators by engagement on posts"
      columns={[
        {
          key: "composite_score",
          label: "Engagement",
          format: (v) => {
            if (typeof v === "number") return v.toFixed(1);
            return String(v) ?? "—";
          },
        },
        {
          key: "market_cap",
          label: "Market Cap",
          format: (v) => {
            if (typeof v === "number") return `$${(v / 1000).toFixed(0)}k`;
            return String(v) ?? "—";
          },
        },
      ]}
    />
  );
}

