#!/usr/bin/env bash
# CampusClout — start the full platform
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

# ── 1. Python venv & deps ─────────────────────────────────────────────────────
info "Python environment..."
cd "$BACKEND"
[[ ! -d .venv ]] && python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip 2>/dev/null || true
.venv/bin/pip install -q -r requirements.txt 2>/dev/null || true
ok "Python deps"

# ── 2. Migrations (Optional) ───────────────────────────────────────────────────
if [[ "$NO_MIGRATE" == false ]]; then
  info "Database migrations..."
  .venv/bin/alembic upgrade head 2>/dev/null || warn "Migrations skipped (database may already be initialized)"
fi

# ── 3. Frontend deps ──────────────────────────────────────────────────────────
info "Frontend..."
cd "$FRONTEND"
[[ ! -d node_modules ]] && npm install --silent 2>/dev/null || true
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
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "  Backend PID: ${YELLOW}$BACKEND_PID${NC} (logs: tail -f /tmp/backend.log)"

sleep 3

cd "$FRONTEND"
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "  Frontend PID: ${YELLOW}$FRONTEND_PID${NC} (logs: tail -f /tmp/frontend.log)"

echo ""
echo "  Troubleshooting:"
echo "  - Backend won't start? Check: tail -f /tmp/backend.log"
echo "  - Frontend won't start? Check: tail -f /tmp/frontend.log"
echo ""

trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
