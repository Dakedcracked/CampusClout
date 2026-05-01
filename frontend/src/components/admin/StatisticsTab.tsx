"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface StatCard {
  label: string;
  value: string | number;
  trend?: string;
  icon: string;
}

interface ChartData {
  date: string;
  count: number;
}

export default function StatisticsTab() {
  const [stats, setStats] = useState<StatCard[]>([]);
  const [userTrend, setUserTrend] = useState<ChartData[]>([]);
  const [roomTrend, setRoomTrend] = useState<ChartData[]>([]);
  const [postTrend, setPostTrend] = useState<ChartData[]>([]);
  const [roleBreakdown, setRoleBreakdown] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  async function loadStatistics() {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/admin/statistics", {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || []);
        setUserTrend(data.user_trend || []);
        setRoomTrend(data.room_trend || []);
        setPostTrend(data.post_trend || []);
        setRoleBreakdown(data.role_breakdown || {});
      }
    } catch (err) {
      console.error("Failed to load statistics:", err);
    } finally {
      setLoading(false);
    }
  }

  const maxValue = Math.max(
    ...(userTrend.map((d) => d.count) || [1]),
    ...(roomTrend.map((d) => d.count) || [1]),
    ...(postTrend.map((d) => d.count) || [1])
  );

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass-card p-4 rounded-lg h-24 animate-pulse bg-surface"
            />
          ))
        ) : stats.length === 0 ? (
          <p className="col-span-4 text-center text-text-muted text-sm py-8">
            No data available
          </p>
        ) : (
          stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-4 rounded-lg border border-border"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-semibold text-text-muted uppercase">
                  {stat.label}
                </p>
                <span className="text-lg">{stat.icon}</span>
              </div>
              <div className="text-2xl font-bold text-text-primary mb-1">
                {stat.value.toLocaleString()}
              </div>
              {stat.trend && (
                <p
                  className={`text-xs ${
                    stat.trend.startsWith("+")
                      ? "text-neon-green"
                      : "text-red-400"
                  }`}
                >
                  {stat.trend} vs last 7 days
                </p>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Users Trend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-4 rounded-lg border border-border"
        >
          <h3 className="font-semibold text-text-primary mb-4">
            Users (7 days)
          </h3>
          <div className="space-y-2">
            {userTrend.length === 0 ? (
              <p className="text-xs text-text-muted">No data</p>
            ) : (
              userTrend.map((d) => (
                <div key={d.date} className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted w-12 flex-shrink-0">
                    {d.date}
                  </span>
                  <div className="flex-1 bg-surface rounded h-6 overflow-hidden">
                    <div
                      className="bg-neon-blue/60 h-full transition-all"
                      style={{
                        width: `${(d.count / maxValue) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-text-muted w-8 text-right flex-shrink-0">
                    {d.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Rooms Trend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4 rounded-lg border border-border"
        >
          <h3 className="font-semibold text-text-primary mb-4">
            Rooms (7 days)
          </h3>
          <div className="space-y-2">
            {roomTrend.length === 0 ? (
              <p className="text-xs text-text-muted">No data</p>
            ) : (
              roomTrend.map((d) => (
                <div key={d.date} className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted w-12 flex-shrink-0">
                    {d.date}
                  </span>
                  <div className="flex-1 bg-surface rounded h-6 overflow-hidden">
                    <div
                      className="bg-accent/60 h-full transition-all"
                      style={{
                        width: `${(d.count / maxValue) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-text-muted w-8 text-right flex-shrink-0">
                    {d.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Posts Trend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4 rounded-lg border border-border"
        >
          <h3 className="font-semibold text-text-primary mb-4">
            Posts (7 days)
          </h3>
          <div className="space-y-2">
            {postTrend.length === 0 ? (
              <p className="text-xs text-text-muted">No data</p>
            ) : (
              postTrend.map((d) => (
                <div key={d.date} className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted w-12 flex-shrink-0">
                    {d.date}
                  </span>
                  <div className="flex-1 bg-surface rounded h-6 overflow-hidden">
                    <div
                      className="bg-neon-purple/60 h-full transition-all"
                      style={{
                        width: `${(d.count / maxValue) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-text-muted w-8 text-right flex-shrink-0">
                    {d.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Role Breakdown */}
      {Object.keys(roleBreakdown).length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-4 rounded-lg border border-border"
        >
          <h3 className="font-semibold text-text-primary mb-4">
            Role Distribution
          </h3>
          <div className="space-y-3">
            {Object.entries(roleBreakdown).map(([role, count]) => {
              const total = Object.values(roleBreakdown).reduce(
                (a, b) => a + b,
                0
              );
              const percentage = Math.round((count / total) * 100);

              const colorMap: Record<string, string> = {
                USER: "bg-blue-500/60",
                MEMBER: "bg-green-500/60",
                CO_ADMIN: "bg-yellow-500/60",
                ADMIN: "bg-red-500/60",
              };

              return (
                <div key={role} className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-secondary w-16 flex-shrink-0">
                    {role}
                  </span>
                  <div className="flex-1 bg-surface rounded h-6 overflow-hidden">
                    <div
                      className={`${colorMap[role] || "bg-neon-purple/60"} h-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted w-12 text-right flex-shrink-0">
                    {percentage}%
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
