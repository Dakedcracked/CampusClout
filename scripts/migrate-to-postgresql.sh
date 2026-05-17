#!/bin/bash
# ==================== PostgreSQL Migration Helper ====================
# This script helps migrate from SQLite to PostgreSQL for production

set -e  # Exit on error

echo "🚀 CampusClout SQLite → PostgreSQL Migration Helper"
echo "=================================================="

# Check for required tools
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL client (psql) not found. Install it first."
    echo "   Linux: sudo apt-get install postgresql-client"
    echo "   macOS: brew install postgresql"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found."
    exit 1
fi

# Activate virtual environment
if [ -f "backend/.venv/bin/activate" ]; then
    source backend/.venv/bin/activate
else
    echo "❌ Virtual environment not found at backend/.venv"
    exit 1
fi

# Load environment
if [ ! -f "backend/.env.production" ]; then
    echo "❌ .env.production not found. Copy from .env.production.example and fill in values."
    exit 1
fi

echo ""
echo "📋 Step 1: Verifying database connections..."

# Test PostgreSQL connection
DB_URL=$(grep "DATABASE_URL" backend/.env.production | cut -d '=' -f 2-)
echo "   Testing PostgreSQL: $DB_URL"

# Extract connection details
DB_HOST=$(echo $DB_URL | cut -d '@' -f 2 | cut -d ':' -f 1)
DB_PORT=$(echo $DB_URL | cut -d ':' -f 3 | cut -d '/' -f 1)
DB_USER=$(echo $DB_URL | cut -d ':' -f 2 | cut -d '/' -f 1)
DB_NAME=$(echo $DB_URL | cut -d '/' -f 4)

echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   User: $DB_USER"
echo "   Database: $DB_NAME"

# Test connection
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "   ✅ PostgreSQL connection successful!"
else
    echo "   ❌ PostgreSQL connection failed. Check credentials."
    exit 1
fi

echo ""
echo "📦 Step 2: Installing dependencies..."
pip install -q alembic sqlalchemy asyncpg

echo ""
echo "🔄 Step 3: Running database migrations..."
cd backend
alembic upgrade head

if [ $? -eq 0 ]; then
    echo "   ✅ Migrations completed successfully!"
else
    echo "   ❌ Migration failed. Check logs above."
    exit 1
fi

echo ""
echo "📊 Step 4: Verifying schema..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
\dt+
\di+
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';
EOF

echo ""
echo "✅ PostgreSQL migration complete!"
echo ""
echo "Next steps:"
echo "1. Update your application to use .env.production"
echo "2. Run: export $(cat backend/.env.production | xargs)"
echo "3. Start the application: python -m uvicorn app.main:app"
echo "4. Test database connectivity in application"
echo ""
echo "Backup the old SQLite database:"
echo "   cp backend/app.db /backup/app.db.backup"
echo ""
