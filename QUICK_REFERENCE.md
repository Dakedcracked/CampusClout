# CampusClout — Quick Reference Guide

## 🚀 Start Servers
```bash
cd /home/aditya/Desktop/Sau-statup
bash start.sh
```

**Or manually**:
```bash
# Terminal 1: Backend
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend && npm run dev
```

---

## 🔗 URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs (Swagger)**: http://localhost:8000/api/docs
- **Database**: `postgresql://campusclout@localhost:5432/campusclout`
- **Redis**: `localhost:6379`

---

## 📋 Features Implemented This Session

### 1. Post Edit/Delete
- **Test**: Create post → Click ⋮ → Edit/Delete
- **Endpoint**: `PUT/DELETE /api/v1/feed/{post_id}`

### 2. Campus Chat Images
- **Test**: Chat tab → Click 🖼️ → Select image → Send
- **Endpoint**: `POST /api/v1/global-chat/send` (with image_url)

### 3. Store Product Images
- **Test**: Store tab → Add Product → "Choose image…" → Upload
- **Endpoint**: `POST /api/v1/store/my/products/{product_id}/image`

### 4. Auth Guard
- **Test**: Log in → Try `/login` → Auto-redirects to `/dashboard`

---

## 🔧 Common Tasks

### Add a Database Migration
```bash
cd backend
.venv/bin/alembic revision -m "description" --rev-id NNN
# Edit alembic/versions/NNN_description.py
.venv/bin/alembic upgrade head
```

### Rebuild Frontend
```bash
cd frontend && npm run build
```

### Check Database
```bash
psql postgresql://campusclout@localhost:5432/campusclout
\dt                    # List tables
SELECT * FROM users;   # Query
\q                     # Exit
```

### View API Documentation
Visit: http://localhost:8000/api/docs (interactive Swagger UI)

---

## 📊 Tech Stack Summary
| Layer | Tech | Port |
|-------|------|------|
| Frontend | Next.js 15 + Tailwind | 3000 |
| Backend | FastAPI async | 8000 |
| Database | PostgreSQL 17 | 5432 |
| Cache/PubSub | Redis | 6379 |
| AI | Ollama (llama3.1:8b) | 11434 |

---

## 🎯 Next Features (Backlog)

1. **Leaderboards** — 5 leaderboard types (rising stars, most invested, hottest, beauty queens, store mvp)
2. **Trending Explainer** — Modal showing why profiles trend
3. **Production File Uploads** — S3/Cloudinary instead of base64
4. **Beauty Coins** — Leaderboard-integrated reward system

---

## 📝 Key Files (Quick Navigation)

### Backend Routes
- Feed: `/backend/app/api/v1/feed.py`
- Store: `/backend/app/api/v1/store.py`
- Chat: `/backend/app/api/v1/global_chat.py`
- Auth: `/backend/app/api/v1/auth.py`

### Backend Services
- Feed logic: `/backend/app/services/feed_service.py`
- Store logic: `/backend/app/services/store_service.py`
- Chat logic: `/backend/app/services/global_chat_service.py`

### Frontend Components
- Feed: `/frontend/src/components/feed/PostCard.tsx`
- Store: `/frontend/src/components/store/ProductCard.tsx`
- Chat: `/frontend/src/components/chat/GlobalChat.tsx`
- Dashboard: `/frontend/src/app/(dashboard)/dashboard/page.tsx`

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 8000 is in use
lsof -i :8000

# Check database connection
psql postgresql://campusclout@localhost:5432/campusclout -c "SELECT 1"

# Check Redis
redis-cli ping
```

### Frontend won't compile
```bash
cd frontend
rm -rf .next node_modules
npm install
npm run dev
```

### Database migration failed
```bash
cd backend
# Check current revision
.venv/bin/alembic current

# Downgrade if needed
.venv/bin/alembic downgrade -1

# Try upgrade again
.venv/bin/alembic upgrade head
```

---

## 💡 Architecture Patterns Used

### Image Upload (Reusable Pattern)
```typescript
// File input → Base64 encode → POST JSON → DB storage
const reader = new FileReader();
reader.onload = (e) => fetch('/api/v1/...', {
  method: 'POST',
  body: JSON.stringify({ image_url: e.target.result })
});
reader.readAsDataURL(file);
```

### Author Permission Check (Reusable Pattern)
```typescript
// Check if current user is post author
useEffect(() => {
  const me = await fetch('/api/v1/auth/me').then(r => r.json());
  setIsOwner(me.id === post.owner_id);
}, []);
```

### Auth Guard Layout (Reusable Pattern)
```typescript
// Next.js 13+ route group layout that checks auth
// Redirects authenticated users away from login
// Keeps unauthenticated users on login page
```

---

## 📞 Common API Calls

### Get Current User
```bash
curl http://localhost:8000/api/v1/auth/me \
  -H "Cookie: access_token=..."
```

### Create Post
```bash
curl -X POST http://localhost:8000/api/v1/feed \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello world"}' \
  -H "Cookie: access_token=..."
```

### Edit Post
```bash
curl -X PUT http://localhost:8000/api/v1/feed/{id} \
  -H "Content-Type: application/json" \
  -d '{"content": "Updated content"}' \
  -H "Cookie: access_token=..."
```

### Delete Post
```bash
curl -X DELETE http://localhost:8000/api/v1/feed/{id} \
  -H "Cookie: access_token=..."
```

### Send Chat Message with Image
```bash
curl -X POST http://localhost:8000/api/v1/global-chat/send \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Check this out",
    "image_url": "data:image/png;base64,iVBORw0KG...",
    "image_type": "image"
  }' \
  -H "Cookie: access_token=..."
```

### Create Store Product
```bash
curl -X POST http://localhost:8000/api/v1/store/my/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Stickers Pack",
    "description": "Cool stickers",
    "base_price": 50,
    "stock_count": -1
  }' \
  -H "Cookie: access_token=..."
```

### Upload Product Image
```bash
curl -X POST http://localhost:8000/api/v1/store/my/products/{id}/image \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "data:image/png;base64,iVBORw0KG...",
    "image_type": "image"
  }' \
  -H "Cookie: access_token=..."
```

---

## ✅ Session Checklist

- [x] Post edit/delete feature complete
- [x] Campus chat image uploads complete
- [x] Store product image uploads complete
- [x] Database migrations applied
- [x] Servers running cleanly
- [x] API documentation generated
- [ ] End-to-end feature testing (READY)
- [ ] Leaderboards implementation (NEXT)
- [ ] Trending explainer modal (NEXT)

---

**Last Updated**: This Session | **Status**: All 4 Features Ready for QA
