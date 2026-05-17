#!/bin/bash
# cleanup.sh - Script to clean up unnecessary markdown logs and test scripts

echo "Creating docs and archive directories..."
mkdir -p docs/setup_logs
mkdir -p backend/tests/seed_scripts

echo "Moving setup logs and documentation out of root..."
mv ADMIN_USER_BEHAVIOR_EARNING_GUIDE.md docs/setup_logs/ 2>/dev/null
mv BEAUTY_FEATURE.md docs/setup_logs/ 2>/dev/null
mv DEPLOYMENT_GUIDE.md docs/setup_logs/ 2>/dev/null
mv DEPLOYMENT_READY.txt docs/setup_logs/ 2>/dev/null
mv FINAL_CHECKLIST.md docs/setup_logs/ 2>/dev/null
mv FIXED_LOGIN_ISSUE.md docs/setup_logs/ 2>/dev/null
mv FIX_SUMMARY.md docs/setup_logs/ 2>/dev/null
mv IMPLEMENTATION_SUMMARY.md docs/setup_logs/ 2>/dev/null
mv INDEX.md docs/setup_logs/ 2>/dev/null
mv OTP_TRACKING_DOCUMENTATION.md docs/setup_logs/ 2>/dev/null
mv QUICK_START.md docs/setup_logs/ 2>/dev/null
mv QUICK_START_TESTING.md docs/setup_logs/ 2>/dev/null
mv README_NEW_FEATURES.md docs/setup_logs/ 2>/dev/null
mv STARTUP_README.md docs/setup_logs/ 2>/dev/null
mv START_HERE.md docs/setup_logs/ 2>/dev/null
mv seed_log.txt docs/setup_logs/ 2>/dev/null

echo "Moving test scripts in backend..."
cd backend
mv apply_migration.py tests/seed_scripts/ 2>/dev/null
mv check_posts.py tests/seed_scripts/ 2>/dev/null
mv create_db.py tests/seed_scripts/ 2>/dev/null
mv debug_seed.py tests/seed_scripts/ 2>/dev/null
mv dump_posts.py tests/seed_scripts/ 2>/dev/null
mv populate.py tests/seed_scripts/ 2>/dev/null
mv seed_test_data.py tests/seed_scripts/ 2>/dev/null
mv seed_trending.py tests/seed_scripts/ 2>/dev/null
mv test_db.py tests/seed_scripts/ 2>/dev/null
mv test_otp_tracking.py tests/seed_scripts/ 2>/dev/null
mv test_post.py tests/seed_scripts/ 2>/dev/null
cd ..

echo "Cleanup complete! Unnecessary files have been organized without breaking the app."
