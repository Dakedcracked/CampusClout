"use client";

import { motion } from "framer-motion";

type TabType = "users" | "content" | "rooms" | "statistics";

interface AdminTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: "users", label: "Users", icon: "👥" },
  { id: "content", label: "Content", icon: "📝" },
  { id: "rooms", label: "Rooms", icon: "🚪" },
  { id: "statistics", label: "Statistics", icon: "📊" },
];

export default function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  return (
    <div className="flex items-center gap-1 bg-surface rounded-lg p-1 border border-border">
      {TABS.map((tab) => (
        <motion.button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
            activeTab === tab.id
              ? "bg-neon-purple text-white shadow-lg"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
          }`}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </motion.button>
      ))}
    </div>
  );
}
