#!/usr/bin/env python3
"""Railway startup script for CampusClout backend"""
import subprocess
import sys
import os

# Ensure we're in the backend directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Get port from Railway environment or default to 8000
port = os.environ.get('PORT', '8000')

# Run migrations (optional - will warn if database already initialized)
try:
    subprocess.run(['alembic', 'upgrade', 'head'], capture_output=True)
except Exception as e:
    print(f"[WARN] Migrations skipped: {e}")

# Start uvicorn with the port
cmd = [
    'uvicorn',
    'app.main:app',
    '--host', '0.0.0.0',
    '--port', port,
    '--workers', '4'
]

print(f"[INFO] Starting CampusClout backend on port {port}...")
subprocess.run(cmd)
