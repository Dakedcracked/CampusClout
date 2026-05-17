"use client";

import LeaderboardTable from "./LeaderboardTable";

export default function StoreMVP() {
  return (
    <LeaderboardTable
      metric="store-mvp"
      title="🏪 Store MVP"
      description="Top sellers by sales volume"
      columns={[
        {
          key: "sales_volume",
          label: "Sales",
          format: (v) => {
            if (typeof v === "number") return `$${(v / 100).toFixed(2)}`;
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
