# 🚀 Vercel Deployment Guide - CampusClout

## ✅ Phase 1: Git Setup COMPLETE
- ✅ Repository initialized locally
- ✅ Code committed to `main` branch
- ✅ Remote configured: `https://github.com/Dakedcracked/CampusClout.git`

## 📋 Phase 2: Create GitHub Repository

### Step 1: Create Empty Repository on GitHub
1. Go to https://github.com/new
2. **Repository name:** `CampusClout` (exactly this)
3. **Description:** "Campus social platform with hot profiles scoring and marketplace"
4. **Visibility:** Public (recommended for easy Vercel integration)
5. **Do NOT initialize with README, .gitignore, or license**
6. Click **"Create repository"**

### Step 2: Push Code to GitHub
After creating the repo, run:

```bash
cd /home/aditya/Desktop/Sau-statup

# If you have SSH key set up (recommended):
git remote set-url origin git@github.com:Dakedcracked/CampusClout.git
git push -u origin main

# OR if using HTTPS (requires GitHub Personal Access Token):
git remote set-url origin https://github.com/Dakedcracked/CampusClout.git
git push -u origin main
# When prompted for password, use your Personal Access Token
```

**Get Personal Access Token:**
- GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
- Create new token with `repo` scope
- Copy and paste when prompted during `git push`

---

## 🌐 Phase 3: Deploy Frontend to Vercel

### Step 1: Create Vercel Account
1. Go to https://vercel.com/signup
2. Sign up with GitHub (easiest method)
3. Authorize Vercel to access your GitHub repos

### Step 2: Import Project to Vercel
1. Go to https://vercel.com/dashboard
2. Click **"Add New..." → "Project"**
3. Select **"Import Git Repository"**
4. Select `Dakedcracked/CampusClout` from your repos
5. Click **"Import"**

### Step 3: Configure Vercel Settings
1. **Framework:** Next.js (auto-detected)
2. **Root Directory:** `frontend/` (important!)
3. **Build & Output settings:** Leave defaults

### Step 4: Set Environment Variables
Click **"Environment Variables"** section and add:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

(We'll update this after backend is deployed)

### Step 5: Deploy
Click **"Deploy"** and wait 2-3 minutes.

**Result:** Your frontend URL appears (e.g., `https://campusclout.vercel.app`)

---

## 🔧 Phase 4: Deploy Backend to Railway

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. Authorize Railway

### Step 2: Create New Railway Project
1. Click **"New Project"** (top right)
2. Click **"Deploy from GitHub repo"**
3. Select `Dakedcracked/CampusClout`
4. Railway will auto-detect the backend

### Step 3: Add PostgreSQL Database
1. In Railway dashboard: **"Add Service" → "PostgreSQL"**
2. Wait for it to initialize
3. Click on the PostgreSQL service
4. Copy the `DATABASE_URL` (found in Variables tab)

### Step 4: Add Redis Cache
1. **"Add Service" → "Redis"**
2. Wait for initialization
3. Copy the `REDIS_URL`

### Step 5: Configure Backend Environment Variables
Click your web service (Flask) → **"Variables"** tab and add:

```
DATABASE_URL=<paste from PostgreSQL>
REDIS_URL=<paste from Redis>
JWT_SECRET_KEY=your-super-secret-key-at-least-32-characters-long
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
MAILGUN_API_KEY=<your Mailgun key or leave blank for testing>
MAILGUN_DOMAIN=<your Mailgun domain or leave blank for testing>
SENDER_EMAIL=noreply@campusclout.app
CORS_ORIGINS=["https://campusclout.vercel.app"]
SIGNUP_BONUS_TOKENS=100
STOREFRONT_MIN_MARKET_CAP=500.0
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
VISION_MODEL=llama3.2-vision
VISION_TIMEOUT=20
DEBUG=false
```

### Step 6: Deploy Backend
1. Railway auto-deploys from `main` branch
2. Check deployment logs (may take 2-3 minutes)
3. Copy your Railway backend URL (e.g., `https://campusclout.up.railway.app`)

### Step 7: Run Database Migrations
Once backend is deployed, connect and run migrations:

```bash
# SSH into Railway (or use Railway CLI)
# Option A: Use Railway CLI
npm install -g @railway/cli
railway login
cd backend
railway run .venv/bin/alembic upgrade head

# Option B: Direct command with DATABASE_URL from Railway
export DATABASE_URL="<paste Railway DATABASE_URL>"
cd backend
.venv/bin/alembic upgrade head
```

---

## 🔗 Phase 5: Connect Frontend to Backend

### Step 1: Update Frontend Environment Variable on Vercel
1. Go to Vercel dashboard
2. Select **"CampusClout"** project
3. Click **"Settings" → "Environment Variables"**
4. Update `NEXT_PUBLIC_API_URL`:
   ```
   NEXT_PUBLIC_API_URL=https://campusclout.up.railway.app
   ```
   (Replace with your actual Railway URL)

### Step 2: Redeploy Frontend
1. Go to **"Deployments"** tab
2. Find the latest deployment
3. Click **"⋯" → "Redeploy"**
4. Wait 2-3 minutes for rebuild

---

## ✅ Phase 6: Verification Checklist

### Test Frontend
- [ ] Frontend loads at your Vercel URL
- [ ] No white screen or errors
- [ ] Register page displays
- [ ] Can navigate to all tabs

### Test Backend
- [ ] API docs available: `https://your-railway-url/api/docs`
- [ ] Health check: `curl https://your-railway-url/api/health`

### Test Full Flow
- [ ] Register with .edu email
- [ ] Email verification works
- [ ] Can login
- [ ] Dashboard loads with hot profiles
- [ ] Can view feed, chat, store

### Check Logs
- **Vercel:** Deployments tab → click deployment → View Logs
- **Railway:** Logs tab in dashboard

---

## 🆘 Troubleshooting

### Frontend won't build on Vercel
```
Error: Cannot find module 'X'
→ Check frontend/package.json has all dependencies
→ Try: cd frontend && npm install
→ Redeploy on Vercel
```

### Backend won't start on Railway
```
Error in logs: ModuleNotFoundError
→ Check backend/requirements.txt has all packages
→ Railway may be using different Python version
→ Restart the service from Railway dashboard
```

### CORS errors (frontend can't reach backend)
```
Error: Access to XMLHttpRequest blocked by CORS
→ Check CORS_ORIGINS in Railway backend variables
→ Should be: ["https://your-vercel-url.com"]
→ Restart Railway service after updating
```

### Migration failures
```
Error: Alembic migration failed
→ Check DATABASE_URL is correct
→ Verify database exists and is accessible
→ Check migration file syntax
→ Use: alembic history to see what's been applied
→ Can rollback with: alembic downgrade -1
```

---

## 📊 Architecture After Deployment

```
┌─────────────────────────────────────────────────────┐
│          Vercel (Frontend - Next.js)                │
│  https://campusclout.vercel.app                     │
│  - Serves HTML/CSS/JS                              │
│  - Calls backend at NEXT_PUBLIC_API_URL             │
└───────────────────┬─────────────────────────────────┘
                    │
                    │ API calls
                    ↓
┌─────────────────────────────────────────────────────┐
│       Railway (Backend - FastAPI)                   │
│  https://campusclout.up.railway.app                 │
│  - Handles all business logic                       │
│  - WebSocket for real-time chat                     │
└──────┬────────────────────────┬─────────────────────┘
       │                        │
       ↓                        ↓
   PostgreSQL              Redis
   (Database)              (Cache)
```

---

## 💰 Cost Estimate

| Service | Free Tier | Pricing |
|---------|-----------|---------|
| Vercel | 100 GB bandwidth/month | $20+/month |
| Railway | $5 credits/month | Pay-as-you-go (~$7/month for hobby) |
| PostgreSQL | Included | ~$15/month if max storage |
| Redis | Included | ~$5/month |

**Total:** ~$0-$10/month during development

---

## 🎯 Next Steps

1. ✅ **Create GitHub repo** (empty, don't init with files)
2. ✅ **Push code to GitHub** (`git push -u origin main`)
3. ✅ **Deploy frontend to Vercel** (import GitHub repo)
4. ✅ **Deploy backend to Railway** (import GitHub repo + add services)
5. ✅ **Run database migrations** (Railway CLI or direct DB connection)
6. ✅ **Connect frontend to backend** (update env var + redeploy)
7. ✅ **Test end-to-end flows**

---

## 🚀 You're Ready!

Your CampusClout platform is production-ready. All features are implemented:
- ✅ User authentication with email verification
- ✅ Hot profiles ranking system
- ✅ Social feed with post edit/delete
- ✅ Campus chat with image uploads
- ✅ Marketplace with product management
- ✅ Real-time features with WebSocket
- ✅ AI companion and beauty scoring

**Estimated time to full deployment:** 30-45 minutes

Questions? Check logs in Vercel or Railway dashboards! 🎉

---

**Last updated:** May 1, 2026
**Git Status:** Code committed and ready for GitHub
