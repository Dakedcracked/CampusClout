# Implementation Roadmap - May 1, 2026

## Status: Ready for Full Feature Implementation

### ✅ COMPLETED
- [x] Edit post feature (backend + frontend)
- [x] Delete post feature
- [x] React key warning fix in GlobalChat
- [x] Vercel deployment configuration
- [x] next.config.ts environment variable support

---

## 🔨 IN PROGRESS / PENDING

### 1. Remove Beauty Coins System
**Status:** PENDING  
**Task:** Remove beauty coin rewards/mechanics from the platform

**Files to modify:**
- Backend:
  - `app/models/user.py` - Remove beauty_coins column if exists
  - `app/models/economy.py` - Remove beauty coin transactions
  - `app/api/v1/beauty.py` - Remove coin reward endpoints
  - `app/services/beauty_service.py` - Remove coin logic
  - Database migration - Create migration to drop beauty_coin columns
  
- Frontend:
  - `src/components/economy/` - Remove beauty coin display components
  - `src/components/beauty/` - Update beauty score UI (remove coin rewards)
  - `src/app/dashboard/page.tsx` - Remove beauty coin displays

---

### 2. Implement AI-Based "Hot Profiles" Scoring System
**Status:** PENDING  
**Architecture:** 

**Senior Mathematician Scoring Formula:**

```
Hot Score = 0.35×B + 0.25×E + 0.20×V + 0.20×Q

Where:
  B = Beauty Score (0-100) — from AI analysis
      Weighted by: skin(20%) + style(25%) + grooming(20%) + fitness(15%) + confidence(20%)
  
  E = Engagement Power (0-100) — social interaction
      Formula: min((likes_7d + comments_7d×2 + reposts_7d×3) / 100, 100)
  
  V = Velocity (0-100) — growth momentum
      Formula: min(((hot_votes_7d - not_votes_7d) / max(followers, 1)) × 100, 100)
  
  Q = Quality Score (0-100) — content & profile completeness
      Formula: (bio_filled×20 + avatar_set×20 + posts_count_min(10)×20 + 
                follower_ratio×20 + response_rate×20) / 5
```

**Database Changes:**
- Add `hot_score_cached` to users table
- Add `hot_rank_position` to users table
- Add indexes for trending queries
- Migration: `024_hot_profiles_system.py`

**Backend Implementation:**
- `app/services/hot_profiles_service.py` — Calculate hot scores
- `app/api/v1/hot-profiles.py` — GET endpoints:
  - `GET /api/v1/hot-profiles/top` — Top hot profiles (limit=20)
  - `GET /api/v1/hot-profiles/breakdown/{username}` — Score breakdown
- Scheduler task: Nightly update of hot scores (02:00 UTC)

**Frontend Implementation:**
- `src/components/profiles/HotProfiles.tsx` — Hot profiles leaderboard
- `src/components/profiles/HotProfileCard.tsx` — Card showing score breakdown
- `src/app/dashboard/` — Add Hot Profiles tab (leaderboard view)

---

### 3. Implement Email Verification System
**Status:** PENDING  
**Architecture:**

**Database:**
- Table `email_verifications` (already exists from migration 015)
  - `id`, `user_id`, `token`, `expires_at`, `is_used`, `created_at`

**Backend Flow:**
1. User registers → Create email_verification token (32 chars, 24h TTL)
2. Send email with verification link: `/verify-email?token=...`
3. User clicks → POST /api/v1/auth/verify-email?token=...
4. Backend verifies: token exists, not expired, not used
5. Mark is_used=true, set user.is_verified=true
6. Redirect to login

**Email Service (Mailgun):**
```
MAILGUN_API_KEY=your-key
MAILGUN_DOMAIN=mg.yourdomain.com
SENDER_EMAIL=noreply@campusclout.app
```

**Backend Implementation:**
- `app/services/email_service.py` — Send verification emails via Mailgun
- `app/api/v1/auth.py` — Add/update:
  - `POST /verify-email` endpoint
  - Update `/register` to require verification
- `app/core/config.py` — Add Mailgun credentials
- `app/schemas/auth.py` — Add VerifyEmailRequest schema

**Frontend Implementation:**
- `src/app/(auth)/verify-email/page.tsx` — Verification page
- `src/app/(auth)/register/page.tsx` — Update to show pending verification
- Success modal + resend email button

---

### 4. Remove Profile Votes (Hot/Not Voting)
**Status:** PENDING  
**Task:** Remove the hot/not voting system from profiles

**Files to modify:**
- Backend:
  - Database migration — Drop profile_votes table
  - `app/models/social.py` — Remove ProfileVote model
  - `app/api/v1/profiles.py` — Remove voting endpoints
  - `app/services/profiles_service.py` — Remove voting logic
  
- Frontend:
  - `src/components/profiles/TrendingProfiles.tsx` — Remove voting UI
  - `src/components/profiles/ProfileVoteModal.tsx` — Remove this component

---

## 🎯 Implementation Order

1. **Email Verification** (foundation for secure auth)
2. **Remove Beauty Coins** (simplify economy)
3. **Remove Profile Votes** (simplify trending)
4. **Implement Hot Profiles Scoring** (new ranking system)
5. **Update Dashboard** (add hot profiles tab)
6. **Verify & Deploy to Vercel**

---

## 📊 Testing Checklist

- [ ] Email verification flow works (register → email → verify)
- [ ] Beauty coins removed from all UI and database
- [ ] Profile votes removed from trending calculation
- [ ] Hot profiles scores calculated correctly
- [ ] Hot profiles endpoint returns top 20
- [ ] Score breakdown shows all 4 components
- [ ] All tests pass
- [ ] Frontend builds without errors
- [ ] Backend migrations run successfully

---

## Deployment Steps

1. **Local Testing:**
   - `cd backend && .venv/bin/pytest`
   - `cd frontend && npm run build`

2. **Database Migrations:**
   - `alembic upgrade head`
   - Verify schema changes

3. **Vercel Deployment:**
   - Set `NEXT_PUBLIC_API_URL` env var
   - Deploy frontend to Vercel
   - Deploy backend to Railway/Render

4. **Production Verification:**
   - Test registration with real email
   - Verify email delivery
   - Check hot profiles ranking
   - Monitor logs for errors

---

**Estimated Timeline:** 2-3 hours for complete implementation + testing

**Current Date:** May 1, 2026
