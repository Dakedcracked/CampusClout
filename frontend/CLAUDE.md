# Frontend — CampusClout

## Run
```bash
cd /home/aditya/Desktop/Sau-statup/frontend
npm run dev     # http://localhost:3000
npm run build   # type-check + production build (must pass 0 errors before commit)
```

## Tech
- Next.js 15, App Router, Turbopack
- Tailwind CSS v3.4 (dark theme only)
- Framer Motion for animations
- All API calls to `http://localhost:8000` (proxied via next.config.ts rewrites)

## Pages
| File | Route | Auth |
|---|---|---|
| `app/page.tsx` | / | No — landing page |
| `app/(auth)/login/page.tsx` | /login | No |
| `app/(auth)/register/page.tsx` | /register | No |
| `app/dashboard/page.tsx` | /dashboard | Cookie — redirects to /login if unauthed |

## Dashboard Tabs
```
Feed | Market | Campus | DMs | Campus Chat | AI Companion | Beauty ✨ | Trending 🔥 | Store ◈
```
Full-width tabs (no sidebar): Campus Chat, AI Companion, Beauty, Trending, Store
Sidebar tabs (3-col layout): Feed, Market, Campus, DMs — sidebar has DailyDividend + AlterEgoToggle + LiveTicker

## Component Map
```
components/
├── feed/
│   ├── Feed.tsx           GET /api/v1/feed — ranked post list
│   ├── CreatePost.tsx     POST /api/v1/feed — new post form (content + optional media URL)
│   ├── PostCard.tsx       POST /api/v1/feed/{id}/like — post card with like, comments toggle, media display
│   └── PostComments.tsx   GET/POST /api/v1/feed/{id}/comments — expandable comment section
├── chat/
│   ├── ChatInbox.tsx      GET /api/v1/chat/threads — DM inbox
│   ├── ChatThread.tsx     WS + REST — single thread view
│   ├── GlobalChat.tsx     useGlobalChat hook — campus-wide chat
│   └── MessageBubble.tsx  (stateless display)
├── ticker/
│   └── LiveTicker.tsx     useMarketTicker hook — live market events
├── heatmap/
│   └── CampusHeatmap.tsx  POST /checkin + GET /heatmap
├── store/
│   ├── MyStorefront.tsx   Full storefront management CRUD
│   ├── BrowseStorefronts.tsx  Browse + purchase
│   └── ProductCard.tsx    (stateless display)
├── alter-ego/
│   └── AlterEgoToggle.tsx Create/toggle/delete alter-ego
├── economy/
│   └── DailyDividend.tsx  POST /economy/daily-dividend — countdown timer
├── ai/
│   ├── AICompanion.tsx    Ollama chat — 4 personas with persona picker overlay
│   └── BeautyScore.tsx    5-slider assessment + animated score ring + tips accordion
└── profiles/
    └── TrendingProfiles.tsx  GET /api/v1/profiles/trending — hot/not voting + follow/unfollow in modal
```

## Hooks
```
hooks/
├── useChatWebSocket.ts    WS /api/v1/ws/chat/{thread_id} — DM real-time
├── useGlobalChat.ts       WS /api/v1/global-chat/ws — campus chat + Rush Hour
└── useMarketTicker.ts     WS /api/v1/ws/ticker — market cap stream
```
All WS hooks: fetch ticket → connect → ping every 25s → store pingRef → clear on unmount/close.

## Design System (Tailwind)
```
Colors (defined in tailwind.config.ts):
  background     #09090b   (zinc-950)
  surface        #18181b   (zinc-900)
  surface-raised #27272a   (zinc-800)
  border         #3f3f46   (zinc-700)
  text-primary   #fafafa
  text-secondary #a1a1aa   (zinc-400)
  text-muted     #71717a   (zinc-500)
  accent         #22c55e   (green-500) — tokens, positive
  clout          #a78bfa   (violet-400) — market cap
  danger         #ef4444   (red-500)
  clout-dim      #4c1d95/30
  accent-dim     #14532d/30

Utility classes (globals.css):
  .glass-card       bg-surface border border-border rounded-xl backdrop-blur-sm
  .stat-ticker      font-mono text-sm tabular-nums
  .clout-badge      bg-clout-dim text-clout pill
  .token-badge      bg-accent-dim text-accent pill
```

## API Proxy
All `/api/v1/*` calls go through Next.js rewrites to `http://localhost:8000`.
Set `NEXT_PUBLIC_API_URL` env var to override for direct calls (WS hooks use this).

## Rules for New Components
- Always `"use client"` for any component with state or effects
- Use `credentials: "include"` on all fetch calls (JWT in cookies)
- WS auth: always fetch `/api/v1/auth/ws-ticket` first, pass `?ticket=` in WS URL
- Store pingRef in `useRef`, clear interval in `ws.onclose` AND in cleanup return
- Never use `key={timestamp}` alone — use composite `${user_id}-${timestamp}`
- `(username?.[0] ?? "?").toUpperCase()` for avatar initials — never `username[0]`
- Google Fonts: `<link>` tags in `layout.tsx` only — never `@import` in CSS (breaks Turbopack)

## Environment
```
NEXT_PUBLIC_API_URL=http://localhost:8000   (set in .env.local for direct WS calls)
```

## Beauty Score Component Details
- Step 1: 5 sliders (1-10) for skincare/style/grooming/fitness/confidence
- Step 2: Animated SVG ring (score/100, color coded green/yellow/orange/red)
- Step 3: Dimension bar chart
- Step 4: Accordion tips (one section per dimension, 3 AI tips each)
- On load: tries GET /ai/beauty/score → if found shows result, else shows assessment form

## AICompanion Component Details
- Personas: supportive 💙 / motivational 🔥 / companion 🌿 / lover 💕
- Persona picker: full-screen overlay (z-20) with card buttons
- Typing indicator: 3 animated bouncing dots while Ollama responds
- Streak display: badge in header
- On persona switch: immediately adds greeting message to chat
- Messages rendered with avatar icon (persona emoji) for AI side

## GlobalChat Component Details
- Rush Hour state: glowing yellow border + animated badge from WS event
- Sends via REST POST /global-chat/send (not WS) — WS is receive-only
- Token reward displayed per message (+1 or +2 ⚡)

## Adding a New Tab
1. Add to `type Tab = ...` union in dashboard/page.tsx
2. Add to `TABS` array
3. Add to `FULL_WIDTH_TABS` if no sidebar needed
4. Add render block in the JSX content section
5. Import the component at top
