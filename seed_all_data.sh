#!/usr/bin/env bash
# CampusClout — Seed All Dummy Data
# Run this to fill your database with dummy users, trending profiles, and posts.

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     CampusClout - Data Seeder        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

cd "$BACKEND"

if [[ ! -d .venv ]]; then
  warn "Virtual environment not found! Start the app using fresh_start.sh first."
  exit 1
fi

info "Seeding base posts and base users..."
.venv/bin/python scripts/seed.py 2>/dev/null || true
ok "Base seed complete."

info "Seeding hot dummy profiles for trending..."
.venv/bin/python ../scripts/seed_hot_profiles.py 2>/dev/null || true
ok "Hot profiles seeded."

info "Seeding psychological profiles..."
.venv/bin/python ../scripts/seed_psychological_profiles.py 2>/dev/null || true
ok "Psychological profiles seeded."

echo ""
ok "All dummy posts and trending profiles have been successfully added to your database!"
echo -e "${YELLOW}Note: If the backend is already running, the new posts will be available immediately!${NC}"
echo ""
