#!/usr/bin/env python3
"""Test OTP and tracking systems without running full migrations."""

import asyncio
import sys
sys.path.insert(0, '/home/aditya/Desktop/Sau-statup/backend')

from app.services.otp_service import generate_otp


async def test_otp():
    """Test OTP generation."""
    print("Testing OTP generation...")
    otp = await generate_otp()
    print(f"✓ Generated OTP: {otp}")
    assert len(otp) == 6
    assert otp.isdigit()
    print("✓ OTP format valid\n")


def test_models():
    """Test model imports."""
    print("Testing model imports...")
    try:
        from app.models.otp import OTPSession, TrackingConsent
        from app.models.tracking import (
            UserTrackingEvent,
            TrackingEventType,
            UserBehaviorProfile,
            UserInterest,
        )
        print("✓ OTP models imported successfully")
        print("✓ Tracking models imported successfully")
        
        # Test enum
        print(f"✓ Event types available: {[e.value for e in TrackingEventType][:3]}...")
        print()
    except Exception as e:
        print(f"✗ Model import failed: {e}\n")
        raise


def test_schemas():
    """Test schema imports."""
    print("Testing schema imports...")
    try:
        from app.schemas.auth import (
            OTPRequestRequest,
            OTPVerifyRequest,
            OTPResendRequest,
        )
        from app.schemas.tracking import (
            TrackingEventLogRequest,
            UserBehaviorProfileResponse,
            TrackingConsentResponse,
        )
        print("✓ Auth schemas imported successfully")
        print("✓ Tracking schemas imported successfully\n")
    except Exception as e:
        print(f"✗ Schema import failed: {e}\n")
        raise


def test_services():
    """Test service imports."""
    print("Testing service imports...")
    try:
        from app.services.otp_service import (
            generate_otp,
            create_otp_session,
            verify_otp,
            resend_otp,
        )
        from app.services.tracking_service import (
            log_event,
            get_user_behavior_profile,
            create_or_update_behavior_profile,
            derive_user_interests,
            set_tracking_consent,
        )
        from app.services.email_service import send_otp_email
        print("✓ OTP service imported successfully")
        print("✓ Tracking service imported successfully")
        print("✓ Email service (with OTP support) imported successfully\n")
    except Exception as e:
        print(f"✗ Service import failed: {e}\n")
        raise


def test_endpoints():
    """Test endpoint definitions."""
    print("Testing endpoint definitions...")
    try:
        from app.api.v1.auth import router as auth_router
        from app.api.v1.tracking import router as tracking_router
        
        auth_routes = [route.path for route in auth_router.routes]
        tracking_routes = [route.path for route in tracking_router.routes]
        
        print(f"✓ Auth endpoints: {len(auth_routes)}")
        print(f"  - OTP endpoints: {[r for r in auth_routes if 'otp' in r]}")
        
        print(f"✓ Tracking endpoints: {len(tracking_routes)}")
        print(f"  - Tracking routes: {[r for r in tracking_routes if r != '/']}\n")
    except Exception as e:
        print(f"✗ Endpoint import failed: {e}\n")
        raise


async def main():
    """Run all tests."""
    print("=" * 60)
    print("🔧 OTP & TRACKING SYSTEM INITIALIZATION TESTS")
    print("=" * 60)
    print()
    
    try:
        test_models()
        test_schemas()
        test_services()
        test_endpoints()
        await test_otp()
        
        print("=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)
        print("\nSystem is ready for deployment.")
        print("\nNext steps:")
        print("1. Apply database migrations: alembic upgrade head")
        print("2. Start the backend server")
        print("3. Test OTP endpoints:")
        print("   POST /api/v1/auth/otp/request")
        print("   POST /api/v1/auth/otp/verify")
        print("4. Test tracking endpoints:")
        print("   POST /api/v1/tracking/events")
        print("   GET /api/v1/tracking/profile")
        
    except Exception as e:
        print("\n" + "=" * 60)
        print("❌ TEST FAILED")
        print("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
