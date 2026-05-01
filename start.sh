#!/usr/bin/env bash
# CampusClout — single command to start the full platform
# Usage: bash start.sh [--no-migrate] [--no-seed]
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
NO_MIGRATE=false
NO_SEED=false
for arg in "$@"; do
  [[ "$arg" == "--no-migrate" ]] && NO_MIGRATE=true
  [[ "$arg" == "--no-seed" ]] && NO_SEED=true
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║      CampusClout  —  Start          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ── 1. PostgreSQL ─────────────────────────────────────────────────────────────
info "PostgreSQL..."
if ! systemctl is-active --quiet postgresql 2>/dev/null; then
  sudo systemctl start postgresql && sudo systemctl enable postgresql
fi
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='campusclout'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER campusclout WITH PASSWORD 'campusclout';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='campusclout'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE campusclout OWNER campusclout;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE campusclout TO campusclout;" > /dev/null 2>&1
sudo -u postgres psql -d campusclout -c "GRANT ALL ON SCHEMA public TO campusclout;" > /dev/null 2>&1 || true
ok "PostgreSQL (campusclout@localhost:5432/campusclout)"

# ── 2. Redis ──────────────────────────────────────────────────────────────────
info "Redis..."
if ! systemctl is-active --quiet redis 2>/dev/null; then
  sudo systemctl start redis && sudo systemctl enable redis
fi
redis-cli ping 2>/dev/null | grep -q PONG && ok "Redis (localhost:6379)" || warn "Redis not responding"

# ── 3. Ollama ─────────────────────────────────────────────────────────────────
info "Ollama..."
if command -v ollama &>/dev/null; then
  if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    ollama serve > /tmp/ollama.log 2>&1 &
    sleep 2
  fi
  MODELS=$(curl -s http://localhost:11434/api/tags 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(' '.join(m['name'] for m in d.get('models',[])))" 2>/dev/null || echo "")
  if echo "$MODELS" | grep -q "llama3.1"; then
    ok "Ollama (llama3.1:8b ready)"
  else
    warn "llama3.1:8b not found — pulling now (this may take a few minutes)..."
    ollama pull llama3.1:8b && ok "Ollama model ready"
  fi
else
  warn "Ollama not installed — AI features will use fallback responses"
fi

# ── 4. Python venv & deps ─────────────────────────────────────────────────────
info "Python environment..."
cd "$BACKEND"
[[ ! -d .venv ]] && python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt
ok "Python deps"

# ── 5. Migrations ─────────────────────────────────────────────────────────────
if [[ "$NO_MIGRATE" == false ]]; then
  info "Database migrations..."
  .venv/bin/alembic upgrade head
  ok "Migrations up to date"
fi

# ── 6. Seed data ──────────────────────────────────────────────────────────────
if [[ "$NO_SEED" == false ]]; then
  info "Seeding sample data..."
  .venv/bin/python scripts/seed.py 2>/dev/null && ok "Sample data seeded" || warn "Seed skipped (data may already exist)"
fi

# ── 7. Frontend deps ──────────────────────────────────────────────────────────
info "Frontend..."
cd "$FRONTEND"
[[ ! -d node_modules ]] && npm install --silent
ok "npm deps"

# ── Launch ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Starting servers...                ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  API:      ${GREEN}http://localhost:8000${NC}"
echo -e "  Docs:     ${GREEN}http://localhost:8000/api/docs${NC}"
echo -e "  Frontend: ${GREEN}http://localhost:3000${NC}"
echo ""
echo "  Press Ctrl+C to stop all servers."
echo ""

cd "$BACKEND"
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/campusclout_backend.log 2>&1 &
BACKEND_PID=$!
echo -e "  Backend PID: ${YELLOW}$BACKEND_PID${NC} (logs: /tmp/campusclout_backend.log)"

sleep 2

cd "$FRONTEND"
npm run dev > /tmp/campusclout_frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "  Frontend PID: ${YELLOW}$FRONTEND_PID${NC} (logs: /tmp/campusclout_frontend.log)"

trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
