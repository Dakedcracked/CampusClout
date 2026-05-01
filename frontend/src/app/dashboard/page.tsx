"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import LiveTicker from "@/components/ticker/LiveTicker";
import AlterEgoToggle from "@/components/alter-ego/AlterEgoToggle";
import Feed from "@/components/feed/Feed";
import ChatInbox from "@/components/chat/ChatInbox";
import GlobalChat from "@/components/chat/GlobalChat";
import MyStorefront from "@/components/store/MyStorefront";
import BrowseStorefronts from "@/components/store/BrowseStorefronts";
import DailyDividend from "@/components/economy/DailyDividend";
import AICompanion from "@/components/ai/AICompanion";
import BeautyScore from "@/components/ai/BeautyScore";
import TrendingProfiles from "@/components/profiles/TrendingProfiles";
import ProfilePage from "@/components/profiles/ProfilePage";
import Settings from "@/components/settings/Settings";
import RoomList from "@/components/rooms/RoomList";
import Inbox from "@/components/inbox/Inbox";
import GlobalSearch from "@/components/search/GlobalSearch";
import AdminTabs from "@/components/admin/AdminTabs";
import UsersTab from "@/components/admin/UsersTab";
import ContentTab from "@/components/admin/ContentTab";
import RoomsTab from "@/components/admin/RoomsTab";
import StatisticsTab from "@/components/admin/StatisticsTab";

interface User {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  email: string;
  university_domain: string;
  is_verified: boolean;
  role?: "USER" | "MEMBER" | "CO_ADMIN" | "ADMIN";
}

interface Balance {
  wallet_balance: number;
  tokens_invested_in_me: number;
  market_cap: number;
  beauty_coins?: number;
}

interface AlterEgoInfo {
  alias: string;
  is_active: boolean;
}

type Tab =
  | "feed" | "chat" | "global" | "ai" | "beauty" | "trending"
  | "store" | "profile" | "search" | "inbox" | "settings" | "rooms" | "admin";

const PRIMARY_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "feed",     label: "Home",    icon: "◈" },
  { id: "search",   label: "Search",  icon: "🔍" },
  { id: "trending", label: "Trending",icon: "🔥" },
  { id: "inbox",    label: "Inbox",   icon: "💌" },
  { id: "profile",  label: "Profile", icon: "👤" },
];

const ALL_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "feed",     label: "Home",        icon: "◈" },
  { id: "search",   label: "Search",      icon: "🔍" },
  { id: "trending", label: "Trending",    icon: "🔥" },
  { id: "inbox",    label: "Inbox",       icon: "💌" },
  { id: "chat",     label: "Messages",    icon: "💬" },
  { id: "rooms",    label: "Rooms",       icon: "🚪" },
  { id: "global",   label: "Campus",      icon: "🌐" },
  { id: "ai",       label: "AI Companion",icon: "🤖" },
  { id: "beauty",   label: "Beauty",      icon: "✨" },
  { id: "store",    label: "Store",       icon: "🏪" },
  { id: "profile",  label: "Profile",     icon: "👤" },
  { id: "settings", label: "Settings",    icon: "⚙️" },
];

const SECONDARY_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "chat",     label: "Messages", icon: "💬" },
  { id: "rooms",    label: "Rooms",    icon: "🚪" },
  { id: "global",   label: "Campus",   icon: "🌐" },
  { id: "ai",       label: "AI",       icon: "🤖" },
  { id: "beauty",   label: "Beauty",   icon: "✨" },
  { id: "store",    label: "Store",    icon: "🏪" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

function AdminDashboard() {
  const [adminTab, setAdminTab] = useState<"users" | "content" | "rooms" | "statistics">("statistics");
  return (
    <div className="flex flex-col gap-6">
      <AdminTabs activeTab={adminTab} onTabChange={setAdminTab} />
      {adminTab === "users" && <UsersTab />}
      {adminTab === "content" && <ContentTab />}
      {adminTab === "rooms" && <RoomsTab />}
      {adminTab === "statistics" && <StatisticsTab />}
    </div>
  );
}

function UserAvatar({ user, size = 32 }: { user: User; size?: number }) {
  const colors = ["#9d4edd", "#f472b6", "#60a5fa", "#00e5a0", "#fbbf24"];
  const color = colors[user.username.charCodeAt(0) % colors.length];
  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatar_url} alt={user.username}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }} />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}99)`, fontSize: size * 0.4 }}>
      {((user.display_name ?? user.username)?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [alterEgo, setAlterEgo] = useState<AlterEgoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [userRes, balRes, aeRes] = await Promise.all([
          fetch("/api/v1/auth/me", { credentials: "include" }),
          fetch("/api/v1/economy/me/balance", { credentials: "include" }),
          fetch("/api/v1/alter-ego", { credentials: "include" }),
        ]);
        if (!userRes.ok) { router.push("/login"); return; }
        setUser(await userRes.json());
        if (balRes.ok) setBalance(await balRes.json());
        if (aeRes.ok) {
          const ae = await aeRes.json();
          if (ae) setAlterEgo({ alias: ae.alias, is_active: ae.is_active });
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-[#9d4edd] border-t-transparent animate-spin" />
        <div className="gradient-text font-mono font-bold">Loading CampusClout…</div>
      </div>
    );
  }

  const isAdmin = user?.role && ["CO_ADMIN", "ADMIN"].includes(user.role);

  const sidebarTabs = [
    ...ALL_TABS,
    ...(isAdmin ? [{ id: "admin" as Tab, label: "Admin", icon: "🛡️" }] : []),
  ];

  const moreSheetTabs = [
    ...SECONDARY_TABS,
    ...(isAdmin ? [{ id: "admin" as Tab, label: "Admin", icon: "🛡️" }] : []),
  ];

  function renderContent() {
    switch (activeTab) {
      case "feed":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
            <div className="lg:col-span-2">
              <Feed
                alterEgoActive={alterEgo?.is_active ?? false}
                alterEgoAlias={alterEgo?.alias ?? null}
                userAvatar={user?.avatar_url}
                username={user?.username}
              />
            </div>
            <aside className="hidden lg:flex flex-col gap-4">
              <DailyDividend />
              <AlterEgoToggle />
              <LiveTicker />
            </aside>
          </div>
        );
      case "search":   return <GlobalSearch />;
      case "trending": return user ? <TrendingProfiles myUsername={user.username} /> : null;
      case "inbox":    return <Inbox />;
      case "chat":     return user ? <ChatInbox myUserId={user.id} myMarketCap={balance?.market_cap ?? 0} /> : null;
      case "rooms":    return <RoomList />;
      case "global":   return user ? <GlobalChat username={user.username} /> : null;
      case "ai":       return <AICompanion />;
      case "beauty":   return user ? <BeautyScore username={user.username} /> : null;
      case "store":    return user ? (
        <div className="grid md:grid-cols-2 gap-6">
          <MyStorefront username={user.username} />
          <BrowseStorefronts />
        </div>
      ) : null;
      case "profile":  return user ? (
        <ProfilePage user={user} balance={balance}
          onUserUpdate={(u) => setUser((prev) => prev ? { ...prev, ...u } : prev)} />
      ) : null;
      case "settings": return user ? (
        <Settings user={user}
          onUserUpdate={(u) => setUser((prev) => prev ? { ...prev, ...u } : prev)}
          onLogout={logout} />
      ) : null;
      case "admin":    return isAdmin ? <AdminDashboard /> : null;
      default:         return null;
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">

      {/* ── Desktop Left Sidebar ── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-[220px] border-r border-[#181818] bg-[#0a0a0a] z-30">
        {/* Logo */}
        <div className="px-5 pt-6 pb-4">
          <span className="text-xl font-black gradient-text-ig tracking-tight">CampusClout</span>
          {alterEgo?.is_active && (
            <p className="mt-1.5">
              <span className="clout-badge text-[10px] animate-pulse">👾 {alterEgo.alias}</span>
            </p>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 overflow-y-auto">
          {sidebarTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-medium transition-all duration-150 text-left ${
                activeTab === tab.id
                  ? "bg-[#191919] text-white"
                  : "text-[#555] hover:text-[#bbb] hover:bg-[#111]"
              }`}
            >
              <span className="text-[17px] leading-none w-6 text-center flex-shrink-0">{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-[#181818]">
          <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#111] transition-colors group cursor-pointer"
            onClick={() => setActiveTab("profile")}>
            {user && <UserAvatar user={user} size={36} />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {user?.display_name ?? user?.username}
              </p>
              <p className="text-[11px] text-[#444] font-mono">
                ◈ {balance?.wallet_balance.toLocaleString() ?? "—"}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); logout(); }}
              className="text-[#444] hover:text-[#aaa] transition-colors text-xs opacity-0 group-hover:opacity-100 p-1 flex-shrink-0"
              title="Logout"
            >
              ↩
            </button>
          </div>
        </div>
      </aside>

      {/* ── Content area ── */}
      <div className="flex-1 md:ml-[220px] flex flex-col min-h-screen">

        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#181818]">
          <div className="h-14 flex items-center justify-between px-4">
            <span className="text-lg font-black gradient-text-ig tracking-tight">CampusClout</span>
            <div className="flex items-center gap-2">
              {alterEgo?.is_active && (
                <span className="clout-badge text-[10px] animate-pulse">👾</span>
              )}
              {balance && (
                <span className="token-badge text-[10px]">◈ {balance.wallet_balance.toLocaleString()}</span>
              )}
              {user && (
                <button onClick={() => setActiveTab("profile")} className="flex-shrink-0">
                  <UserAvatar user={user} size={28} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 px-3 md:px-6 py-4 pb-20 md:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0a0a0a]/98 backdrop-blur-xl border-t border-[#181818]">
          <div className="flex items-center justify-around h-[56px] px-1">
            {PRIMARY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl flex-1 transition-all ${
                  activeTab === tab.id ? "text-white" : "text-[#555]"
                }`}
              >
                <span className={`text-[22px] leading-none transition-transform duration-150 ${activeTab === tab.id ? "scale-110" : ""}`}>
                  {tab.icon}
                </span>
                <span className={`text-[9px] font-semibold tracking-wide transition-colors ${activeTab === tab.id ? "text-white" : "text-[#444]"}`}>
                  {tab.label}
                </span>
              </button>
            ))}
            {/* More */}
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl flex-1 transition-all ${
                moreSheetTabs.some(t => t.id === activeTab) ? "text-white" : "text-[#555]"
              }`}
            >
              <span className="text-[22px] leading-none">≡</span>
              <span className={`text-[9px] font-semibold tracking-wide ${moreSheetTabs.some(t => t.id === activeTab) ? "text-white" : "text-[#444]"}`}>
                More
              </span>
            </button>
          </div>
        </nav>
      </div>

      {/* ── Mobile More sheet ── */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden"
            onClick={() => setMoreOpen(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="absolute bottom-0 left-0 right-0 bg-[#111] border-t border-[#222] rounded-t-[28px]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="w-10 h-1 bg-[#333] rounded-full mx-auto mt-3 mb-3" />

              {/* User info */}
              {user && (
                <div className="flex items-center gap-3 px-5 pb-4 border-b border-[#1a1a1a]">
                  <UserAvatar user={user} size={42} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm">{user.display_name ?? user.username}</p>
                    <p className="text-xs text-[#555] font-mono">
                      @{user.username} · ◈ {balance?.wallet_balance.toLocaleString() ?? "0"}
                    </p>
                  </div>
                </div>
              )}

              {/* Secondary tabs grid */}
              <div className="grid grid-cols-4 gap-1 p-4">
                {moreSheetTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setMoreOpen(false); }}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl transition-all ${
                      activeTab === tab.id
                        ? "bg-[#1a1a1a] text-white"
                        : "text-[#777] hover:bg-[#1a1a1a] hover:text-white"
                    }`}
                  >
                    <span className="text-[26px] leading-none">{tab.icon}</span>
                    <span className="text-[10px] font-medium text-center leading-tight">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Logout */}
              <div className="px-5 pb-8 pt-1 border-t border-[#1a1a1a]">
                <button
                  onClick={logout}
                  className="w-full py-3 text-sm text-[#666] hover:text-white transition-colors text-center"
                >
                  Log out @{user?.username}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
