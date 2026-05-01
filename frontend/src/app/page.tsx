"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const TICKER_ITEMS = [
  { user: "alex_mit", change: "+12.4%", cap: "4,821" },
  { user: "priya_stanford", change: "+8.1%", cap: "9,204" },
  { user: "marcus_harvard", change: "-3.2%", cap: "2,100" },
  { user: "zoe_nyu", change: "+22.7%", cap: "6,550" },
  { user: "dev_caltech", change: "+5.0%", cap: "3,305" },
  { user: "luna_yale", change: "+18.3%", cap: "12,440" },
  { user: "zara_caltech", change: "+31.0%", cap: "15,920" },
];

const FEATURES = [
  { icon: "💘", color: "#ff4d6d", title: "Find Your Match", desc: "Browse campus profiles, discover chemistry, and start conversations instantly." },
  { icon: "🔥", color: "#ff6b81", title: "Flirty Rooms", desc: "Join live rooms and meet people in real time — perfect for quick, playful chats." },
  { icon: "✨", color: "#f472b6", title: "AI Dating Coach", desc: "Get conversation prompts, flirty responses, and coaching for your next match." },
  { icon: "🤖", color: "#f97316", title: "AI Companion", desc: "Choose a companion persona for supportive, romantic, or playful chat." },
  { icon: "🌹", color: "#a855f7", title: "Profile Discovery", desc: "Search profiles by name, interests, or vibe and connect with campus singles." },
  { icon: "📸", color: "#60a5fa", title: "Share Moments", desc: "Post photos and videos to show the real you and make authentic connections." },
];

export default function LandingPage() {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <main className="flex flex-col min-h-screen overflow-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-background/80 backdrop-blur-xl sticky top-0 z-20">
        <span className="text-xl font-black gradient-text tracking-tight">CampusClout</span>
        <div className="flex items-center gap-2">
          <Link href="/login" className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors font-medium">
            Login
          </Link>
          <Link href="/register" className="btn-primary text-sm">
            Join Now →
          </Link>
        </div>
      </nav>

      {/* Live Ticker */}
      <div className="overflow-hidden border-b border-border/40 bg-surface/60 py-2.5">
        <motion.div className="flex gap-10 whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }} transition={{ duration: 30, ease: "linear", repeat: Infinity }}>
          {doubled.map((item, i) => (
            <span key={i} className="stat-ticker flex items-center gap-2 text-sm">
              <span className="text-neon-purple">●</span>
              <span className="text-text-muted">@{item.user}</span>
              <span className={item.change.startsWith("+") ? "text-accent font-bold" : "text-danger font-bold"}>
                {item.change}
              </span>
              <span className="token-badge">{item.cap} ◈</span>
            </span>
          ))}
        </motion.div>
      </div>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center gap-8 relative">
        {/* Background glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-neon-purple/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-neon-pink/8 blur-3xl pointer-events-none" />

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="flex flex-col items-center gap-6 relative z-10">
          <div className="neon-badge text-sm px-4 py-1.5">❤️ Campus dating social network</div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight max-w-3xl leading-tight">
            Swipe campus connections,
            <span className="gradient-text">spark real chemistry.</span>
          </h1>

          <p className="text-lg text-text-muted max-w-xl mx-auto leading-relaxed">
            Meet campus singles, chat in rooms, and build meaningful connections with the people around you.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <Link href="/register" className="btn-primary text-base px-8 py-3.5">
              Start Matching →
            </Link>
            <Link href="/login" className="btn-secondary text-base px-8 py-3.5">
              Sign In
            </Link>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}
          className="grid grid-cols-3 gap-4 mt-8 max-w-lg w-full relative z-10">
          {[
            { label: "Tokens Minted", value: "◈ 1M+", color: "text-accent" },
            { label: "Active Users", value: "500+", color: "text-clout" },
            { label: "Universities", value: "10+", color: "text-neon-pink" },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card-glow px-4 py-4 text-center">
              <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
              <div className="text-xs text-text-muted mt-1">{label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24 max-w-6xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="text-center mb-12">
          <h2 className="text-3xl font-black gradient-text">Everything you need</h2>
          <p className="text-text-muted mt-2">A complete social economy built for campus life.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map(({ icon, color, title, desc }, i) => (
            <motion.div key={title}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="glass-card p-6 flex flex-col gap-3 hover:border-opacity-50 transition-all duration-300"
              style={{ "--glow-color": color } as React.CSSProperties}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
                {icon}
              </div>
              <h3 className="font-bold text-text-primary">{title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20 text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="glass-card-glow max-w-2xl mx-auto p-10 flex flex-col items-center gap-5">
          <div className="text-5xl animate-float">🚀</div>
          <h2 className="text-2xl font-black text-text-primary">Ready to meet someone new?</h2>
          <p className="text-text-muted">Join with any email. 100 welcome tokens and the best campus dating experience.</p>
          <Link href="/register" className="btn-primary text-base px-10 py-3.5">
            Create Account →
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-border/40 py-6 text-center text-text-muted text-sm">
        © 2026 CampusClout · Campus dating social platform
      </footer>
    </main>
  );
}
