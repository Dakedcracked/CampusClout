"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import AdminTabs from "@/components/admin/AdminTabs";
import UsersTab from "@/components/admin/UsersTab";
import ContentTab from "@/components/admin/ContentTab";
import RoomsTab from "@/components/admin/RoomsTab";
import StatisticsTab from "@/components/admin/StatisticsTab";

type TabType = "users" | "content" | "rooms" | "statistics";

interface User {
  role: "USER" | "MEMBER" | "CO_ADMIN" | "ADMIN";
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("statistics");

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.push("/login");
          return;
        }

        const userData = await res.json();
        setUser(userData);

        // Check if user is admin
        if (
          userData.role !== "ADMIN" &&
          userData.role !== "CO_ADMIN"
        ) {
          router.push("/dashboard");
          return;
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-neon-purple border-t-transparent animate-spin" />
        <div className="gradient-text font-mono font-bold">
          Verifying admin access…
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black gradient-text tracking-tight">
              Admin Panel
            </span>
            <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-lg font-semibold">
              {user.role}
            </span>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="btn-ghost text-xs"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Tab Navigation */}
        <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "users" && <UsersTab />}
            {activeTab === "content" && <ContentTab />}
            {activeTab === "rooms" && <RoomsTab />}
            {activeTab === "statistics" && <StatisticsTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
