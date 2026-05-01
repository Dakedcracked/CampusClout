# CampusClout — Trending Profiles System Design

**Date**: 2026-05-01 | **Role**: Senior Business Analyst + CEO

---

## 🎯 Strategic Overview

### Problem Statement
Current system lacks a dynamic ranking mechanism to surface top performers. We need a **merit-based engagement economy** where:
- **Content creators** earn visibility through quality uploads
- **Community** votes on attractiveness (hot/not)
- **Market signals** (token investment) validate popularity
- **Wallet mechanics** enable users to boost/support profiles

### Business Objective
Create FOMO-driven viral loops where top 20 profiles get 80% visibility = 10x+ engagement multiplier = monetization.

---

## 💡 Trending Profile Score Formula

### Core Ranking Algorithm (Composite Score)
```
TRENDING_SCORE = (Market_Cap × 0.35) + (Hot_Ratio × 0.30) + (Content_Power × 0.20) + (Engagement_Velocity × 0.15)
```

#### 1. **Market Cap Component (35% weight)**
- Measures wealth/status
- `market_cap` already exists in database
- Range: 100 → 100,000 tokens (normalized 0-100)
- **Why**: Money talks; invested tokens = real backing

#### 2. **Hot Ratio Component (30% weight)**
- Attractiveness + personality
- Calculation: `hot_votes / (hot_votes + not_votes + 1)`
- Range: 0.0 → 1.0
- **Why**: Drives dating/social engagement (FOMO for singles)

#### 3. **Content Power Component (20% weight)**
- Quality of recent uploads
- Factors:
  - `engagement_7d` (likes, comments, shares on posts)
  - `post_count_7d` (activity frequency)
  - `media_ratio` (% of posts with images/videos)
- Formula: `(engagement_7d / 100) + (post_count_7d / 10) + (media_ratio × 0.5)`
- Range: 0 → ~2.0 (capped at 1.0 after normalization)
- **Why**: Fresh, visual content drives engagement

#### 4. **Engagement Velocity Component (15% weight)**
- Growth trajectory (are they trending UP or down?)
- Calculation: `(current_engagement - engagement_7d_ago) / max(engagement_7d_ago, 1)`
- Range: -1.0 → +5.0 (clamped to -0.5 to +1.0 normalized)
- **Why**: Reward momentum; suppress "has-beens"

---

## 🎬 User Journey: Content → Trending

### Phase 1: Upload Content
```
User uploads image/video/post
↓
System extracts metadata:
  • File type (image/video)
  • Timestamp
  • Author
  • Initial engagement (0 initially)
```

### Phase 2: Community Rates Content
```
Other users view post
↓
Actions available:
  • Like (❤️) → +1 engagement point
  • Comment → +5 engagement points
  • Share → +10 engagement points
  • Hot vote (👍) → increases attractiveness
  • Not vote (👎) → decreases attractiveness
↓
Engagement counter updates real-time
```

### Phase 3: Profile Score Recalculation
```
Nightly job (02:00 UTC):
  • Recalculate TRENDING_SCORE for all users
  • Re-rank leaderboards
  • Top 20 move to "Trending" tab
  • Bottom move to normal discovery
```

### Phase 4: Visibility Boost
```
Top 20 profiles:
  • Featured on Trending tab
  • 2x algorithm boost in recommendations
  • Rush Hour 2x multiplier applies (21:00-22:00 UTC)
  • Higher feed visibility
```

---

## 💰 Monetization Levers: Wallet Points System

### What Are "Wallet Points"?
**Premium currency** users purchase to:
1. **Boost own profile** (increase trending rank)
2. **Support creators** (transfer to their wallet)
3. **Buy cosmetics** (badges, effects, themes)

### Wallet Point Pricing
```
$4.99   → 50 points
$9.99   → 120 points (20% bonus)
$19.99  → 300 points (50% bonus)
$49.99  → 900 points (80% bonus)
$99.99  → 2000 points (100% bonus)
```

### Usage Model: Profile Boost
```
Cost: 100 points per 24h boost
Effect:
  • +50 TRENDING_SCORE during boost window
  • 3x visibility in discovery feed
  • Appears at top of recommendations
  • "🚀 BOOSTED" badge on profile
```

### Usage Model: Creator Support
```
Send creator 100 points → Creator gets 75 points (25% platform fee)
Sent points appear in their wallet
Creators can cash out at 0.01 USD per point
This drives creator retention
```

---

## 🔥 Leaderboards (5 Paths to Virality)

### 1. **Rising Stars** (Growth Leaders)
```
Rank by: Engagement_Velocity (15-day growth rate)
Updates: Daily
Top 20 feature week-over-week gainers
Reward: Recognition badge, featured story
```

### 2. **Most Invested** (Wealth Leaders)
```
Rank by: tokens_invested_in_me (direct market cap proxy)
Updates: Real-time (as users invest)
Top 20 = wealthiest profiles
Reward: "VIP" badge, exclusive chat room
```

### 3. **Hottest** (Attractiveness Leaders)
```
Rank by: hot_votes / (hot_votes + not_votes)
Minimum: 50 total votes (to prevent gaming)
Updates: Daily
Top 20 = most attractive by community vote
Reward: "🔥 Hot" badge, dating priority matches
```

### 4. **Content Kings/Queens** (Creator Leaders)
```
Rank by: total_engagement (all-time likes + comments + shares)
Updates: Daily
Top 20 = most engaged creators
Reward: "Creator" badge, monetization tools (live streams)
```

### 5. **Store MVPs** (Commerce Leaders)
```
Rank by: store_sales_volume (tokens sold this month)
Updates: Daily
Top 20 = highest earners
Reward: "Store Master" badge, 10% store fee reduction
```

---

## 📊 Database Changes Required

### New Table: `profile_trending_scores`
```sql
CREATE TABLE profile_trending_scores (
  user_id UUID PRIMARY KEY,
  market_cap_component FLOAT DEFAULT 0,      -- 35% weight
  hot_ratio_component FLOAT DEFAULT 0,        -- 30% weight
  content_power_component FLOAT DEFAULT 0,    -- 20% weight
  engagement_velocity_component FLOAT DEFAULT 0, -- 15% weight
  composite_score FLOAT DEFAULT 0,            -- final ranking score
  trending_rank INT,                          -- 1-20 for top tier
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### New Table: `wallet_points`
```sql
CREATE TABLE wallet_points (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  balance INT DEFAULT 0,
  total_earned INT DEFAULT 0,
  total_spent INT DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### New Table: `point_transactions`
```sql
CREATE TABLE point_transactions (
  id UUID PRIMARY KEY,
  from_user_id UUID,
  to_user_id UUID,
  amount INT NOT NULL,
  transaction_type ENUM('purchase', 'boost', 'support', 'cashout'),
  status ENUM('pending', 'completed', 'failed'),
  created_at TIMESTAMP
);
```

### New Table: `content_uploads`
```sql
CREATE TABLE content_uploads (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  url STRING,
  type ENUM('image', 'video', 'post'),
  engagement_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  share_count INT DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Existing Table Additions
```sql
ALTER TABLE users ADD COLUMN trending_rank INT DEFAULT NULL;
ALTER TABLE users ADD COLUMN has_boost BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN boost_expires_at TIMESTAMP DEFAULT NULL;
```

---

## 🏗️ Implementation Roadmap

### Phase 1: Scoring Foundation (Week 1)
- [ ] Create profile_trending_scores table
- [ ] Implement TRENDING_SCORE calculation logic in backend service
- [ ] Create daily scheduled job to recalculate scores
- [ ] Add trending/{metric} endpoints

### Phase 2: Leaderboards (Week 2)
- [ ] Implement 5 leaderboard endpoints
- [ ] Frontend: 5 leaderboard pages (tab views)
- [ ] Sorting by metric, pagination
- [ ] Live ranking updates

### Phase 3: Wallet System (Week 3)
- [ ] Create wallet_points & point_transactions tables
- [ ] Integrate Stripe payment (or mock)
- [ ] Point purchase flow
- [ ] Creator cashout mechanism

### Phase 4: Boost Mechanics (Week 4)
- [ ] Profile boost purchase endpoint
- [ ] Boost timer logic (24h expiry)
- [ ] Boost badge display
- [ ] Boost effect on ranking (temporary +50)

### Phase 5: Content Engagement (Week 4)
- [ ] Fix post like/comment/share counters
- [ ] Engagement tracking
- [ ] Content_Power calculation
- [ ] Feed ranking by engagement

---

## 🎮 Gamification Mechanics

### FOMO Levers
1. **Rush Hour** (21:00-22:00 UTC): 2x tokens in chat = 2x engagement
2. **Weekly Contests**: "Top Rising Star this week wins 500 tokens"
3. **Expiring Boosts**: "Your boost expires in 2 hours!" notifications
4. **Trending Notification**: "You're now #7 hottest profile! 🔥"

### Status Signals
- **"🚀 BOOSTED"** badge (temporary, high visibility)
- **"🔥 HOT"** badge (hot ratio #1)
- **"💰 WEALTHY"** badge (market cap #1)
- **"👑 CREATOR"** badge (engagement #1)
- **"🛍️ STORE MASTER"** badge (sales #1)

### Retention Loops
- **Daily login bonus**: +5 points
- **3-day streak**: Unlock "trending explainer" view
- **7-day streak**: 10% point bonus on purchases
- **30-day streak**: Exclusive cosmetic theme

---

## 💡 Why People Will Spend Money

### For Singles (Dating Angle)
- "I need to be in Top 20 to get dates"
- "I'll buy boost to appear hotter"
- **Lever**: Hot vote system + Trending visibility

### For Ego/Status
- "I want the 🔥 Hot badge"
- "I need to be wealthier than my rival"
- **Lever**: Market cap leaderboard + wallet display

### For Creators
- "I need visibility to grow"
- "I'll buy boost to launch new content"
- "I want to rank #1 creator"
- **Lever**: Creator leaderboard + content engagement multiplier

### For Collectors
- "I'm investing in my friend's profile"
- "This person will be famous; investing now"
- **Lever**: Wallet transfer system + creator cashout

---

## 📈 Success Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| Daily Active Users | +50% | 30 days |
| Avg Session Length | 25 min | 14 days |
| Point Purchase Rate | 15% of users | 45 days |
| Top 20 Engagement | 10x baseline | 30 days |
| Trending volatility | 30% daily churn | Ongoing |

---

## 🔐 Anti-Manipulation Safeguards

1. **Voting Cooldown**: Users can only vote once per profile per 24h
2. **Minimum Vote Threshold**: Profiles need 50+ votes to appear in rankings
3. **Vote Weight Decay**: Votes from low-market-cap users = lower weight
4. **Engagement Verification**: Fake engagement detection (rapid spikes flagged)
5. **Boost Transparency**: Boost status disclosed prominently

---

## Next Steps
1. Create database migrations for 4 new tables
2. Implement scoring engine
3. Build leaderboard endpoints
4. Design leaderboard frontend
5. Integrate Stripe (or mock payment)
6. Deploy scoring scheduler
