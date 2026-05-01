# CampusClout — University-Exclusive Social Trading Platform

A cutting-edge platform where students earn and trade "Clout Tokens" (◈), invest in each other's profiles, and compete on leaderboards. Think Stock Market meets Instagram meets Campus Life.

---

## 🚀 Quick Start

```bash
cd /home/aditya/Desktop/Sau-statup
bash start.sh          # Installs deps, runs migrations, starts both servers
```

| Service | Port | URL |
|---------|------|-----|
| Backend | 8000 | http://localhost:8000 |
| API Docs | 8000 | http://localhost:8000/api/docs |
| Frontend | 3000 | http://localhost:3000 |
| PostgreSQL | 5432 | campusclout@localhost:5432/campusclout |
| Redis | 6379 | localhost:6379 |

---

## 🏗️ Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS v3.4 + Framer Motion |
| Backend | FastAPI (async) + SQLAlchemy 2.0 async + asyncpg |
| Database | PostgreSQL 17 |
| Cache | Redis 8 (PubSub + sessions) |
| AI | Ollama (llama3.1:8b, local) |
| Real-time | WebSocket + Redis pub/sub |
| Scheduler | APScheduler (AsyncIOScheduler, UTC) |
| Auth | JWT in httpOnly cookies (15min access + 7d refresh) |

---

## 📊 Core Features

### User Economy
- **Signup Bonus**: 100 tokens
- **Market Cap Formula**: `tokens_invested × velocity_mult × engagement_mult`
- **Daily Dividend**: 10-50 random tokens (once/24h)
- **Market Cap Decay**: 2% nightly for inactive users

### Content & Engagement
- **Feed**: Create, edit, delete posts with media
- **Campus Chat**: Global chat with image/video support + Rush Hour (2x tokens 21:00-22:00 UTC)
- **Profile Votes**: Hot/Not rating system contributing to trending scores

### Monetization
- **Wallet Points**: Premium currency ($4.99–$99.99 purchases)
- **Profile Boost**: 100 points for 24h visibility spike (+50 trending score)
- **Creator Support**: Transfer points to friends (25% platform fee)
- **Store**: User-owned shops with product images + discounts for invested users

### Trending System
- **5 Leaderboards**: Rising Stars, Most Invested, Hottest, Content Kings, Store MVPs
- **Composite Scoring**: Market Cap (35%) + Hot Ratio (30%) + Content Power (20%) + Velocity (15%)
- **Boost Mechanics**: Temporary rank boost + "🚀 BOOSTED" badge

### AI Companion
- **4 Personas**: Supportive 💙, Motivational 🔥, Companion 🌿, Lover 💕
- **Streak System**: Unlock deeper responses at 3/7/14/30 day streaks
- **Memory**: Last 20 turns in Redis, persistent in database

---

## 📁 Project Structure

```
Sau-statup/
├── README.md                   ← This file
├── start.sh                    ← One-command startup
├── backend/
│   ├── CLAUDE.md              ← Backend dev guide
│   ├── requirements.txt
│   ├── alembic/versions/      ← 023 migrations (latest: trending system)
│   └── app/
│       ├── main.py            ← FastAPI app + lifespan
│       ├── core/              ← Config, database, security
│       ├── models/            ← SQLAlchemy ORM
│       ├── schemas/           ← Pydantic validators
│       ├── api/v1/            ← API routes
│       ├── services/          ← Business logic
│       ├── ws/                ← WebSocket managers
│       ├── tasks/             ← Scheduler jobs
│       └── middleware/        ← Rate limiting
└── frontend/
    ├── CLAUDE.md              ← Frontend dev guide
    ├── src/
    │   ├── app/               ← Next.js pages
    │   ├── components/        ← React components
    │   ├── hooks/             ← Custom hooks
    │   └── lib/               ← Utilities
    └── public/
```

---

## 🎯 Recent Work (Latest Session)

### Bugs Fixed ✅
1. **Profile search** — Fixed endpoint URL (/profile → /profiles)
2. **Room chat errors** — Added comprehensive error handling
3. **React imports** — Fixed useEffect import in PostCard

### Features Implemented ✅
1. **Post edit/delete** — Full CRUD with author checks
2. **Chat images** — Upload images/videos in global chat
3. **Store images** — Product images with file restrictions
4. **Trending system** — 4-component scoring + 5 leaderboards
5. **Wallet system** — Points, boost, transfer mechanics

### Backend Endpoints (New)
```
GET  /api/v1/leaderboards/{metric}  — Query trending profiles
GET  /api/v1/wallet/balance         — Check wallet points
POST /api/v1/wallet/boost           — Purchase visibility boost
POST /api/v1/wallet/transfer        — Send points to friend
```

---

## 🔧 Development

### Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Database Migrations
```bash
cd backend
.venv/bin/alembic revision -m "description" --rev-id NNN
# Edit alembic/versions/NNN_description.py
.venv/bin/alembic upgrade head
```

### Run Tests
```bash
# Backend
cd backend && .venv/bin/pytest

# Frontend
cd frontend && npm run test
```

---

## 🎓 Key Concepts

### Clout Tokens (◈)
Primary in-game currency. Earned through engagement, can be invested in other profiles or used in stores.

### Market Cap
User's perceived value = tokens invested in them × velocity multiplier × engagement multiplier. Updates in real-time.

### Wallet Points
Premium currency. Purchased with real money ($4.99–$99.99). Used for boosts and profile features.

### Trending Score
Composite metric: 35% market cap + 30% attractiveness + 20% content quality + 15% growth velocity. Top 20 get exponential visibility.

### Rush Hour
21:00–22:00 UTC daily. All tokens earned in chat worth 2x. Drives concurrent users.

### Engagement Multiplier
Bonus to market cap based on activity (likes, comments, shares). Decays after 24h of inactivity.

---

## 📈 Business Model

| Revenue Stream | Mechanism | Target |
|---|---|---|
| **Wallet Purchases** | $4.99–$99.99 for points | 15% conversion (30 days) |
| **Platform Fee** | 25% on point transfers | Creator → Platform |
| **Store Sales** | Commission on product sales | 10% of GMV |
| **Premium Features** | Future cosmetics, themes | Optional |

**FOMO Hooks**:
- Top 20 visibility = 10x engagement
- Expiring boosts trigger notifications
- Leaderboard rank fluctuations (real-time)
- Rush Hour time pressure (21:00–22:00 UTC)

---

## 🐛 Known Issues & To-Do

### Completed ✅
- [x] Profile search
- [x] Room chat
- [x] Post CRUD
- [x] Media uploads
- [x] Trending scoring
- [x] Wallet system

### In Progress 🔄
- [ ] Frontend leaderboard pages
- [ ] Wallet UI (points display + boost)
- [ ] Scheduler job (nightly ranking)

### Planned 📅
- [ ] Stripe payment integration
- [ ] Boost expiry cleanup scheduler
- [ ] Trending explainer modal
- [ ] Production file uploads (S3/Cloudinary)

---

## 📞 API Quick Reference

### Leaderboards
```bash
# Rising Stars (growth leaders)
curl http://localhost:8000/api/v1/leaderboards/rising-stars?limit=20

# Most Invested (wealthiest)
curl http://localhost:8000/api/v1/leaderboards/most-invested?limit=20

# Hottest (attractiveness)
curl http://localhost:8000/api/v1/leaderboards/hottest?limit=20

# Content Kings (engagement)
curl http://localhost:8000/api/v1/leaderboards/content-kings?limit=20

# Store MVPs (top sellers)
curl http://localhost:8000/api/v1/leaderboards/store-mvp?limit=20
```

### Wallet
```bash
# Get balance
curl http://localhost:8000/api/v1/wallet/balance \
  -H "Cookie: access_token=YOUR_TOKEN"

# Buy boost
curl -X POST http://localhost:8000/api/v1/wallet/boost?duration_hours=24 \
  -H "Cookie: access_token=YOUR_TOKEN"

# Transfer points
curl -X POST "http://localhost:8000/api/v1/wallet/transfer?to_username=alice&amount=100" \
  -H "Cookie: access_token=YOUR_TOKEN"
```

---

## 🌐 Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql+asyncpg://campusclout@localhost:5432/campusclout
REDIS_URL=redis://localhost:6379
JWT_SECRET_KEY=your-secret-key
OLLAMA_MODEL=llama3.1:8b
SIGNUP_BONUS_TOKENS=100
STOREFRONT_MIN_MARKET_CAP=500.0
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 📚 Documentation

- **Backend Guide**: `backend/CLAUDE.md`
- **Frontend Guide**: `frontend/CLAUDE.md`
- **Trending Design**: `TRENDING_SYSTEM_DESIGN.md`
- **Session Updates**: `SESSION_UPDATES.md`
- **Quick Start**: `QUICK_FIX_SUMMARY.md`

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Implement changes with tests
3. Run linters and tests locally
4. Submit PR with description
5. Merge after review

---

## 📝 License

MIT License — CampusClout © 2026

---

**Status**: Production-ready backend ✅ | Frontend leaderboards pending 🔄

**Last Updated**: May 1, 2026 | All systems operational ✓
# CampusClout
# CampusClout
# CampusClout
