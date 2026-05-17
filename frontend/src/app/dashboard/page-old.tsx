"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import LiveTicker from "@/components/ticker/LiveTicker";
import AlterEgoToggle from "@/components/alter-ego/AlterEgoToggle";
import Feed from "@/components/feed/Feed";
import ChatInbox from "@/components/chat/ChatInbox";
import MyStorefront from "@/components/store/MyStorefront";
import BrowseStorefronts from "@/components/store/BrowseStorefronts";
import AICompanion from "@/components/ai/AICompanion";
import ProfilePage from "@/components/profiles/ProfilePage";
import Settings from "@/components/settings/Settings";

export const dynamic = "force-dynamic";
import RoomList from "@/components/rooms/RoomList";
import Inbox from "@/components/inbox/Inbox";
import GlobalSearch from "@/components/search/GlobalSearch";
import MatchesPage from "@/components/matches/MatchesPage";
import CampusConfessions from "@/components/feed/CampusConfessions";
import AdminTabs from "@/components/admin/AdminTabs";
import UsersTab from "@/components/admin/UsersTab";
import ContentTab from "@/components/admin/ContentTab";
import RoomsTab from "@/components/admin/RoomsTab";
import StatisticsTab from "@/components/admin/StatisticsTab";
import BeautyAnalyzer from "@/components/beauty/BeautyAnalyzer";
import StreakBanner from "@/components/gamification/StreakBanner";

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
  | "feed" | "chat" | "ai" | "beauty" | "matches" | "confessions"
  | "store" | "profile" | "search" | "inbox" | "settings" | "rooms" | "admin";

interface WsNotification {
  subtype: string;
  actor_id?: string;
  preview?: string;
}

const ICONS: Record<string, React.ReactNode> = {
  feed: <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="w-6 h-6"><path d="M12 2.5L2 10.5h3v9h5v-6h4v6h5v-9h3L12 2.5z"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  trending: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  matches: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>,
  confessions: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><line x1="9" y1="10" x2="15" y2="10"/></svg>,
  inbox: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  profile: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  chat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  rooms: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M9 3v18"/><path d="M14 9h4"/><path d="M14 15h4"/></svg>,
  ai: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
  beauty: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  store: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  admin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  More: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
};

const PRIMARY_TABS: { id: Tab; label: string }[] = [
  { id: "feed",        label: "Home" },
  { id: "beauty",      label: "Beauty AI" },
  { id: "matches",     label: "Meet" },
  { id: "rooms",       label: "Rooms" },
];

const ALL_TABS: { id: Tab; label: string }[] = [
  { id: "feed",        label: "Home" },
  { id: "matches",     label: "Meet People" },
  { id: "confessions", label: "Confessions" },
  { id: "search",      label: "Search" },
  { id: "beauty",      label: "Beauty Analyzer" },
  { id: "inbox",       label: "Inbox" },
  { id: "chat",        label: "Messages" },
  { id: "rooms",       label: "Rooms" },
  { id: "ai",          label: "AI Companion" },
  { id: "profile",     label: "Profile" },
  { id: "settings",    label: "Settings" },
];

const SECONDARY_TABS: { id: Tab; label: string }[] = [
  { id: "search",      label: "Search" },
  { id: "inbox",       label: "Inbox" },
  { id: "chat",        label: "Messages" },
  { id: "confessions", label: "Confessions" },
  { id: "ai",          label: "AI Companion" },
  { id: "profile",     label: "Profile" },
  { id: "settings",    label: "Settings" },
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
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [alterEgo, setAlterEgo] = useState<AlterEgoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tabParam = searchParams.get("activeTab");
    return (tabParam as Tab) || "feed";
  });
  const [moreOpen, setMoreOpen] = useState(false);
  const [wsNotif, setWsNotif] = useState<WsNotification | null>(null);

  // ── Real-time WS notification listener ──────────────────────────────
  useEffect(() => {
    let ws: WebSocket | null = null;
    let dismissed = false;

    async function connect() {
      try {
        const r = await fetch("/api/v1/auth/ws-ticket", { method: "POST", credentials: "include" });
        if (!r.ok) return;
        const { ticket } = await r.json();
        const proto = window.location.protocol === "https:" ? "wss" : "ws";
        const host = process.env.NEXT_PUBLIC_WS_URL ?? `${proto}://${window.location.hostname}:8000`;
        ws = new WebSocket(`${host}/api/v1/ws/live?ticket=${ticket}`);
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === "notification" && data.target_user_id === user?.id) {
              setWsNotif(data);
              setTimeout(() => setWsNotif(null), 4000);
            }
          } catch {}
        };
        ws.onerror = () => ws?.close();
      } catch {}
    }

    if (user) connect();
    return () => { dismissed = true; ws?.close(); };
  }, [user]);

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
    ...(isAdmin ? [{ id: "admin" as Tab, label: "Admin" }] : []),
  ];

  const moreSheetTabs = [
    ...SECONDARY_TABS,
    ...(isAdmin ? [{ id: "admin" as Tab, label: "Admin" }] : []),
  ];

  function renderContent() {
    switch (activeTab) {
      case "feed":
        return (
          <div className="max-w-2xl mx-auto w-full">
            <Feed
              alterEgoActive={alterEgo?.is_active ?? false}
              alterEgoAlias={alterEgo?.alias ?? null}
              userAvatar={user?.avatar_url}
              username={user?.username}
            />
          </div>
        );
      case "matches":     return <MatchesPage />;
      case "confessions": return <CampusConfessions />;
      case "search":   return <GlobalSearch />;
      case "inbox":    return <Inbox />;
      case "chat":     return user ? <ChatInbox myUserId={user.id} myMarketCap={balance?.market_cap ?? 0} /> : null;
      case "rooms":    return <RoomList />;
      case "ai":       return <AICompanion />;
      case "beauty":   return <BeautyAnalyzer />;
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
      {/* Streak Banner — shows on first login of day */}
      <StreakBanner />

      {/* WS Notification Toast */}
      <AnimatePresence>
        {wsNotif && (
          <motion.div
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            className="fixed top-4 right-4 z-[998] bg-[#1a1a1a] border border-[#333] rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 max-w-xs"
          >
            <span className="text-xl">
              {wsNotif.subtype === "post_like" ? "❤️" :
               wsNotif.subtype === "post_comment" ? "💬" :
               wsNotif.subtype === "new_follower" ? "👤" : "🔔"}
            </span>
            <div>
              <p className="text-xs font-semibold text-white">
                {wsNotif.subtype === "post_like" ? "Someone liked your post" :
                 wsNotif.subtype === "post_comment" ? "New comment on your post" :
                 wsNotif.subtype === "new_follower" ? "New follower" : "New notification"}
              </p>
              {wsNotif.preview && (
                <p className="text-[11px] text-[#888] mt-0.5 truncate">{wsNotif.preview}</p>
              )}
            </div>
            <button onClick={() => setWsNotif(null)} className="text-[#555] hover:text-white ml-auto text-sm">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Desktop Left Sidebar ── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-[220px] border-r border-[#181818] bg-[#0a0a0a] z-30">
        {/* Logo */}
        <div className="px-5 pt-6 pb-4">
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
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl mb-1 transition-all duration-150 text-left ${
                activeTab === tab.id
                  ? "bg-[#1a1a1a] text-white font-bold"
                  : "text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#121212]"
              }`}
            >
              <span className={`flex items-center justify-center ${activeTab === tab.id ? "scale-105 transition-transform" : ""}`}>
                {ICONS[tab.id as keyof typeof ICONS]}
              </span>
              <span className="truncate text-[16px]">{tab.label}</span>
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
            <span className="text-base font-bold text-white tracking-tight">
              {ALL_TABS.find(t => t.id === activeTab)?.label ?? "CampusClout"}
            </span>
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
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl flex-1 transition-all ${
                  activeTab === tab.id ? "text-white" : "text-[#a3a3a3]"
                }`}
              >
                <span className={`transition-transform duration-150 ${activeTab === tab.id ? "scale-110" : ""}`}>
                  {ICONS[tab.id as keyof typeof ICONS]}
                </span>
              </button>
            ))}
            {/* More */}
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl flex-1 transition-all ${
                moreSheetTabs.some(t => t.id === activeTab) ? "text-white" : "text-[#a3a3a3]"
              }`}
            >
              <span className="transition-transform duration-150">
                {ICONS["More"]}
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
                    <span className="flex items-center justify-center">
                      {ICONS[tab.id as keyof typeof ICONS]}
                    </span>
                    <span className="text-[11px] font-medium text-center leading-tight mt-1">{tab.label}</span>
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
