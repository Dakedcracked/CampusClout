# Vercel Deployment Guide - CampusClout

## Overview
This guide covers deploying the **Next.js frontend** to Vercel and the **FastAPI backend** to a production service.

---

## Part 1: Frontend Deployment (Vercel) ✅

### Prerequisites
1. Create a Vercel account: https://vercel.com
2. Install Vercel CLI: `npm i -g vercel`
3. Push code to GitHub (Vercel integrates with GitHub)

### Step 1: Prepare Frontend for Vercel

```bash
cd /home/aditya/Desktop/Sau-statup/frontend

# Test production build locally
npm run build
npm run start
# Open http://localhost:3000 to verify
```

### Step 2: Create `vercel.json` (Already in frontend)

Check if `frontend/vercel.json` exists. If not, create it:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev --turbopack",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

### Step 3: Environment Variables on Vercel

Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Add:
```
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

Replace `https://your-api-domain.com` with your backend URL (see Part 2).

### Step 4: Deploy to Vercel

**Option A: Via GitHub (Recommended)**
1. Push code to GitHub
2. Go to Vercel → Import Project
3. Select your GitHub repo
4. Vercel auto-detects `frontend/` as the root
5. Add env vars
6. Click Deploy

**Option B: Via CLI**
```bash
cd frontend
vercel --prod
# Follow prompts
```

### Result
Your frontend will be live at: `https://your-project.vercel.app`

---

## Part 2: Backend Deployment (FastAPI)

### Challenge
Vercel doesn't natively support Python. Options:

1. **Railway** (Recommended) ✅ — Easy PostgreSQL + Redis integration
2. **Render** — Free tier available
3. **Heroku** — Requires buildpack
4. **AWS Lambda** — Serverless but complex
5. **DigitalOcean App Platform** — Self-contained

### Option A: Deploy to Railway ⭐ (Recommended)

#### Step 1: Create Railway Account
- Go to https://railway.app
- Sign in with GitHub

#### Step 2: Set Up Backend on Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Log in
railway login

# From backend directory
cd backend

# Create new project
railway init

# Link to Railway project
railway link

# Add PostgreSQL plugin
# (Via Railway dashboard: Add Service → PostgreSQL)

# Add Redis plugin
# (Via Railway dashboard: Add Service → Redis)

# Deploy
railway up
```

#### Step 3: Configure Environment Variables on Railway

Railway → Your Project → **Variables**

```
DATABASE_URL=postgresql+asyncpg://user:password@host:port/campusclout
REDIS_URL=redis://user:password@host:port
JWT_SECRET_KEY=your-very-secret-key-min-32-chars
OLLAMA_MODEL=llama3.1:8b
SIGNUP_BONUS_TOKENS=100
STOREFRONT_MIN_MARKET_CAP=500.0
VISION_TIMEOUT=10
VISION_MODEL=llama3.2-vision
CORS_ORIGINS=["https://your-project.vercel.app", "http://localhost:3000"]
```

**Note:** For Ollama, you have two options:
1. Run Ollama locally on your machine (not suitable for production)
2. Replace with OpenAI API for AI features (requires API key)

#### Step 4: Get Backend URL

Railway generates a public URL like: `https://campusclout-production.up.railway.app`

Use this as your `NEXT_PUBLIC_API_URL` on Vercel.

---

### Option B: Deploy to Render

#### Step 1: Create Render Account
- Go to https://render.com
- Sign in with GitHub

#### Step 2: Create Web Service
1. Click **New** → **Web Service**
2. Select your GitHub repo
3. Configure:
   - **Build Command:** `pip install -r requirements.txt && alembic upgrade head`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. Add environment variables
5. Deploy

#### Step 3: Attach PostgreSQL & Redis
1. Click **New** → **PostgreSQL**
2. Click **New** → **Redis**
3. Copy connection strings to environment variables

---

## Part 3: Connect Frontend to Backend

### Update Vercel Environment Variables

Once backend is live:

```
NEXT_PUBLIC_API_URL=https://campusclout-production.up.railway.app
```

(or your Render/Heroku URL)

### Redeploy Frontend

```bash
cd frontend
vercel --prod --env NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

Or via Vercel Dashboard → **Redeploy** after env var update.

---

## Part 4: Database & Email Setup

### PostgreSQL
Both Railway/Render provide PostgreSQL. Run migrations:

```bash
# Connect to production database
DATABASE_URL=your_railway_url alembic upgrade head
```

### Redis
Both services provide Redis. Verify connection in logs.

### Email Verification (For New Feature)
Use **Mailgun** (free tier) or **SendGrid**:

```
MAILGUN_API_KEY=your-key
MAILGUN_DOMAIN=mg.yourdomain.com
SENDER_EMAIL=noreply@yourdomain.com
```

---

## Part 5: Monitoring & Logs

### Vercel
- Dashboard → **Logs** → Real-time frontend logs
- Check deployment status and errors

### Railway
- Dashboard → **Logs** → Backend logs in real-time
- Check for crashes, database errors, Redis issues

### Test Health Endpoints

```bash
# Check if backend is running
curl https://your-backend-url.com/api/docs

# Check if frontend loads
curl https://your-project.vercel.app
```

---

## Troubleshooting

### CORS Errors
**Problem:** Frontend can't reach backend
**Solution:** Update `CORS_ORIGINS` in backend `.env`:
```
CORS_ORIGINS=["https://your-project.vercel.app", "https://www.your-project.vercel.app"]
```

### 502 Bad Gateway
**Problem:** Backend crashed
**Solution:** Check Railway/Render logs for errors (usually import or config issue)

### WebSocket Connection Failed
**Problem:** Real-time features broken
**Solution:** Ensure backend URL is correct in frontend env var (use `https://`, not `http://`)

### Ollama Model Not Available
**Problem:** Beauty/AI features fail
**Solution:** Use OpenAI API instead (update backend to use OpenAI SDK)

---

## Summary

| Service | What | How |
|---------|------|-----|
| **Vercel** | Next.js Frontend | Auto-deploy from GitHub, set env vars, done |
| **Railway** | FastAPI Backend | Create project, attach PostgreSQL/Redis, deploy |
| **PostgreSQL** | Database | Auto-provided by Railway |
| **Redis** | Cache | Auto-provided by Railway |
| **Mailgun** | Email Verification | Get API key, add to backend env vars |

---

## Cost Estimation

| Service | Free Tier | Paid |
|---------|-----------|------|
| **Vercel** | 100 GB bandwidth/month | $20/month |
| **Railway** | $5 credits/month | Pay-as-you-go |
| **PostgreSQL (Railway)** | Included | $15/GB extra |
| **Redis (Railway)** | Included | $5/month |
| **Mailgun** | 5,000 emails/month | $0.50/1000 emails |

**Total estimate:** ~$0–$30/month

---

## Next Steps

1. ✅ Create Vercel account
2. ✅ Create Railway account
3. ✅ Deploy frontend to Vercel
4. ✅ Deploy backend to Railway
5. ✅ Update env vars on both platforms
6. ✅ Test end-to-end (login, post, chat, etc.)
7. ✅ Set up email verification
8. ✅ Monitor logs for errors

---

**Status:** Ready to deploy 🚀
