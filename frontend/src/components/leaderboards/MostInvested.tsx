"use client";

import LeaderboardTable from "./LeaderboardTable";

export default function MostInvested() {
  return (
    <LeaderboardTable
      metric="most-invested"
      title="💰 Most Invested"
      description="Wealthiest profiles by market cap"
      columns={[
        {
          key: "market_cap",
          label: "Market Cap",
          format: (v) => {
            if (typeof v === "number") return `$${(v / 1000).toFixed(1)}k`;
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
