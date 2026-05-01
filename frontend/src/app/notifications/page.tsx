"use client";

import { motion } from "framer-motion";
import Inbox from "@/components/inbox/Inbox";

export default function NotificationsPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background"
    >
      <div className="max-w-2xl mx-auto p-4 pt-20">
        <Inbox />
      </div>
    </motion.div>
  );
}
