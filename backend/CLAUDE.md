# Backend — CampusClout API

## Run
```bash
cd /home/aditya/Desktop/Sau-statup/backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Health check: `curl http://localhost:8000/health`

## All API Routes

### Auth — `/api/v1/auth/`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /register | No | Register with .edu email; mints 100 tokens; returns verification token in DEV |
| POST | /login | No | Password login; sets httpOnly JWT cookies; updates last_active_at |
| POST | /logout | No | Clears auth cookies |
| POST | /refresh | Cookie | Rotate access token |
| POST | /verify-email | No | Mark email verified via token |
| GET | /me | Cookie | Current user profile |
| POST | /ws-ticket | Cookie | 30s single-use WS auth ticket (stored in Redis) |

### Economy — `/api/v1/economy/`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /me/balance | Cookie | Wallet + market cap |
| GET | /user/{username}/market-cap | No | Public market cap lookup |
| POST | /invest | Cookie | Invest tokens in another user |
| POST | /withdraw | Cookie | Withdraw invested tokens |
| GET | /leaderboard | No | Top users by market cap |
| POST | /daily-dividend | Cookie | Claim 10-50 random tokens (once/24h) |

### Feed — `/api/v1/feed/`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | / | No | Ranked feed (paginated, skip/limit) |
| POST | / | Cookie | Create post (optional alter-ego, media_url, media_type) |
| POST | /{post_id}/like | Cookie | Toggle like |
| GET | /{post_id}/comments | No | Get post comments (limit 100) |
| POST | /{post_id}/comments | Cookie | Add comment (content, use_alter_ego) |

### Chat (DMs) — `/api/v1/chat/`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /threads | Cookie | List my DM threads |
| POST | /threads/{username} | Cookie | Get or create thread with user |
| GET | /threads/{thread_id}/messages | Cookie | Paginated message history |
| POST | /threads/{thread_id}/messages | Cookie | Send DM |
| GET | /cost/{username} | Cookie | Preview token cost to DM |

### Global Chat — `/api/v1/global-chat/`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /history | No | Last 50 campus messages |
| GET | /rush-hour | No | Is Rush Hour active? |
| POST | /send | Cookie | Send campus message (+1/2 tokens) |
| WS | /ws?ticket= | Ticket | Real-time campus chat stream |

### Store — `/api/v1/store/`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /storefronts | No | Browse all storefronts |
| GET | /storefronts/{username} | No | View storefront |
| GET | /storefronts/{username}/products | No | Products with dynamic pricing |
| GET | /my/eligibility | Cookie | Check 500-cap requirement |
| GET | /my/storefront | Cookie | My storefront |
| POST | /my/storefront | Cookie | Create storefront |
| PATCH | /my/storefront | Cookie | Update name/description |
| POST | /my/products | Cookie | Add product |
| PATCH | /my/products/{id} | Cookie | Edit product |
| DELETE | /my/products/{id} | Cookie | Remove product |
| GET | /my/sales | Cookie | My sales history |
| GET | /my/purchases | Cookie | My purchase history |
| GET | /products/{id}/price | Cookie | Final price with discount |
| POST | /products/{id}/purchase | Cookie | Buy product |

### AI Companion — `/api/v1/ai/companion/`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /message | Cookie | Chat with AI (Ollama llama3.1:8b) |
| GET | /history | Cookie | Conversation history |
| PATCH | /persona | Cookie | Switch persona |

### Beauty — `/api/v1/ai/beauty/`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /analyze | Cookie | Submit 5-dim self-assessment → AI score + tips |
| GET | /score | Cookie | Latest beauty score |

### Profiles & Trending — `/api/v1/profiles/`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /trending | No | Trending profiles by votes + market cap |
| GET | /{username} | No | Public profile with stats + is_following if authed |
| POST | /{username}/vote | Cookie | Cast hot/not vote (once/24h) |
| POST | /{username}/follow | Cookie | Toggle follow/unfollow; returns is_following + follower_count |

### Location — `/api/v1/location/`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /checkin | Cookie | Check in to GPS grid zone |
| GET | /heatmap | No | Aggregated campus activity heatmap |

### Alter-Ego — `/api/v1/alter-ego/`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | / | Cookie | Get my alter-ego |
| POST | / | Cookie | Create alter-ego |
| POST | /toggle | Cookie | Activate / deactivate |
| DELETE | / | Cookie | Delete |

### WebSockets — `/api/v1/ws/`
| Method | Path | Auth | Description |
|---|---|---|---|
| WS | /ticker | None | Live market cap event stream |
| WS | /chat/{thread_id}?ticket= | Ticket | Private DM thread |

## Models & Tables

### users
```
id UUID PK | email String(254) unique | username String(32) unique
hashed_password String(128) | university_domain String(128)
is_verified Bool | is_active Bool | display_name String(64)?
bio Text? | avatar_url String(512)? | last_active_at DateTime?
created_at | updated_at
```
Relations: clout_balance(1:1), alter_ego(1:1), sent_transactions, received_transactions,
           engagement_events, verification_tokens, login_dividends, global_messages,
           ai_conversation(1:1), beauty_scores, profile_votes_received

### clout_balances
```
id | user_id FK(users) unique | wallet_balance Int=0
tokens_invested_in_me Int=0 | market_cap Float=0.0
market_cap_updated_at DateTime?
```

### token_transactions
```
id | from_user_id FK? | to_user_id FK
amount Int | transaction_type Enum(MINT,INVEST,WITHDRAW) | note String(255)?
```

### engagement_events
```
id | user_id FK | event_type Enum(POST_CREATED,POST_LIKED,COMMENT_POSTED,EVENT_CHECKIN,PROFILE_VIEWED)
points Int=1
```

### alter_egos
```
id | user_id FK unique | alias String(32) unique | avatar_seed String(64) | is_active Bool=false
```

### email_verifications
```
id | user_id FK | token String(128) unique | expires_at DateTime | is_used Bool=false
```

### login_dividends
```
id | user_id FK | amount Int | claimed_at DateTime
```

### posts
```
id | author_id FK | content Text | like_count Int=0 | comment_count Int=0
rank_score Float=0.0 | is_alter_ego_post Bool=false | alter_ego_alias String(32)?
media_url String(512)? | media_type String(16)?  (image or video)
```
Rank formula: `log10(max(cap,1)+1) × 1/(1+age_hours×0.1) × (1+likes×0.1)`

### post_comments (migration 010)
```
id | post_id FK | author_id FK | content Text(500)
is_alter_ego Bool=false | alter_ego_alias String(32)?
```

### follows (migration 010)
```
id | follower_id FK | following_id FK
UniqueConstraint(follower_id, following_id, "uq_follow_pair")
```

### post_likes
```
id | user_id FK | post_id FK | UniqueConstraint(user_id, post_id)
```

### chat_threads
```
id | user_a_id FK | user_b_id FK (user_a < user_b canonical)
last_message_at DateTime? | last_icebreaker_at DateTime?
```

### chat_messages
```
id | thread_id FK | sender_id FK? | content Text
token_cost Int=0 | is_ai_icebreaker Bool=false
```

### storefronts
```
id | owner_id FK unique | name String(80) | description Text?
is_active Bool=true | total_sales_volume Int=0
```

### products
```
id | storefront_id FK | name String(120) | description Text?
base_price Int | stock_count Int=-1 (-1=unlimited) | is_active Bool | total_sold Int=0
```

### orders
```
id | buyer_id FK | product_id FK | storefront_id FK
base_price Int | discount_pct Float=0.0 | final_price Int
tokens_invested_at_purchase Int=0
```

### global_messages
```
id | sender_id FK | content Text | token_reward Int=0 | is_rush_hour Bool=false
```

### ai_conversations
```
id | user_id FK unique | persona String(32)=supportive
streak_count Int=0 | last_conversation_at DateTime?
```

### ai_messages
```
id | conversation_id FK | role String(16) | content Text
```

### beauty_scores
```
id | user_id FK | overall_score Float
skincare_score Float | style_score Float | grooming_score Float
fitness_score Float | confidence_score Float
analysis Text | tips Text(JSON)
```

### profile_votes (migration 009)
```
id | voter_id FK | target_id FK | vote_type String(8) hot/not
created_at | UniqueConstraint(voter_id, target_id, date)
```

## Services (business logic)

### auth_service.py
- `register_user()` — validate .edu email, hash password, mint 100 tokens, create EmailVerification
- `authenticate_user()` — bcrypt verify, update last_active_at
- `verify_email()` / `get_user_by_id()`

### token_service.py
- `invest_tokens()` — checks 50% wallet limit, transfers tokens, recalculates cap, broadcasts WS event
- `withdraw_tokens()` — reverses investment, recalculates cap
- `get_leaderboard()` — ORDER BY market_cap DESC
- `_recalculate_market_cap()` — velocity (tx_7d) + engagement (points_7d) multipliers
- `_publish_cap_event()` — emits to `cc:market_cap_updates` Redis channel

### market_service.py
- `claim_daily_dividend()` — 10-50 random tokens, 429 if <24h since last claim
- `decay_inactive_users()` — 2% × market_cap for users with last_active_at > 24h ago

### feed_service.py
- `create_post()` — stores post, fires POST_CREATED engagement event
- `get_feed()` — joins with market cap, Python-side ranking
- `toggle_like()` — upsert PostLike, update like_count

### chat_service.py
- `get_dm_cost()` — max(0, min(floor((target_cap - sender_cap)/100), 50))
- `get_or_create_thread()` — canonical pair (min_id = user_a), deduct token cost
- `send_message()` — create ChatMessage, publish to `cc:chat:{thread_id}`
- `inject_ai_message()` — icebreaker injection, update last_icebreaker_at

### store_service.py
- `check_eligibility()` — market_cap >= STOREFRONT_MIN_MARKET_CAP (500)
- `list_products_with_price()` — discount = min(invested × 0.1, 40)%
- `purchase()` — FOR UPDATE lock on product, deduct tokens, update stock/sales

### social_service.py
- `add_comment()` — validates post exists, creates PostComment, increments post.comment_count
- `get_comments()` — JOIN with User, ordered ASC, up to limit
- `toggle_follow()` — follow/unfollow; increments/decrements follower_count + following_count on both User rows
- `get_follow_status()` — checks Follow row; returns is_following + follower_count + following_count

### global_chat_service.py
- `send_global_message()` — 1 token normal, 2 tokens Rush Hour; publishes to `cc:global_chat`

### ai_companion_service.py
- Calls `POST /api/chat` on Ollama (structured messages)
- 4 personas: supportive / motivational / companion / lover
- Streak: +1 if gap ≤ 48h, reset to 1 otherwise
- Redis memory key: `cc:ai_memory:{user_id}` (last 20 turns, 24h TTL)
- Keyword fallback when Ollama unavailable

### beauty_service.py
- `analyze_beauty()` — 5 sliders (1-10) → Ollama prompt → JSON with scores + 3 tips each
- Weighted score: skincare 20%, style 25%, grooming 20%, fitness 15%, confidence 20%
- Fallback tips hardcoded per dimension if Ollama fails

### ai_service.py
- `generate_icebreaker()` — context-aware DM icebreaker via Ollama

### idle_monitor.py
- Asyncio task, ticks every 60s
- Triggers icebreaker if: last_message > 5min ago, no recent icebreaker, participants online

### alter_ego_service.py / location_service.py
- alter_ego: one per user, alias unique, toggle active state
- location: 0.001° grid snap, Redis zone keys with 1h TTL

## WebSocket Managers

### ws/manager.py — ws_manager
- Channel: `cc:market_cap_updates`
- Called by token_service on every cap change
- Also broadcasts `push_notification` events (Rush Hour alert)

### ws/chat_manager.py — chat_manager
- Channel: `cc:chat:{thread_id}` (per-thread)
- `has_connections(thread_id)` used by idle_monitor to skip offline threads

### ws/global_manager.py — global_chat_manager
- Channel: `cc:global_chat`
- Rush Hour flag: Redis key `cc:rush_hour_active`
- On connect: sends current rush_hour state to new client

## Scheduler (tasks/scheduler.py)
APScheduler AsyncIOScheduler, timezone=UTC
- 03:00 → market_decay
- 21:00 → rush_hour_start (set Redis flag + push notification)
- 22:00 → rush_hour_end

## Adding a New Feature
1. Write migration in `alembic/versions/NNN_name.py`
2. Add ORM model in `app/models/`
3. Add to `app/models/__init__.py`
4. Add relationship on User model if needed
5. Write service in `app/services/`
6. Write router in `app/api/v1/`
7. Register in `app/api/v1/router.py`
8. Run `.venv/bin/alembic upgrade head`

## Critical Patterns
```python
# ORM delete is synchronous
db.delete(obj)          # correct
await db.delete(obj)    # wrong — TypeError

# Enum in migrations — let op.create_table handle type creation
sa.Enum("A","B", name="mytype")  # correct in op.create_table
# Never pre-create with op.execute("CREATE TYPE...") AND use sa.Enum together

# Type annotations use Python types
Mapped[datetime | None]  # correct
Mapped[DateTime | None]  # wrong — DateTime is a column type, not Python type

# Async session for background tasks
async with async_session_factory() as db:
    ...
```
