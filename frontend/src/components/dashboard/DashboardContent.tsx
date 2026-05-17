"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Feed from "@/components/feed/Feed";
import ChatInbox from "@/components/chat/ChatInbox";
import RoomList from "@/components/rooms/RoomList";
import Inbox from "@/components/inbox/Inbox";
import GlobalSearch from "@/components/search/GlobalSearch";
import MatchesPage from "@/components/matches/MatchesPage";
import CampusConfessions from "@/components/feed/CampusConfessions";
import AdminTabs from "@/components/admin/AdminTabs";
import BeautyAnalyzer from "@/components/beauty/BeautyAnalyzer";
import StreakBanner from "@/components/gamification/StreakBanner";
import { motion, AnimatePresence } from "framer-motion";

export default function DashboardContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "feed";

  return (
    <AnimatePresence mode="wait">
      <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
        {tab === "feed" && <Feed />}
        {tab === "chat" && <ChatInbox />}
        {tab === "rooms" && <RoomList />}
        {tab === "inbox" && <Inbox />}
        {tab === "search" && <GlobalSearch />}
        {tab === "matches" && <MatchesPage />}
        {tab === "confessions" && <CampusConfessions />}
        {tab === "admin" && <AdminTabs />}
        {tab === "beauty" && <BeautyAnalyzer />}
      </motion.div>
    </AnimatePresence>
  );
}
