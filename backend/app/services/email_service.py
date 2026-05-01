"""Email service for sending verification and notification emails via Mailgun."""

import logging
from typing import Optional

import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_verification_email(
    recipient_email: str,
    recipient_name: str,
    verification_token: str,
    frontend_url: str = "http://localhost:3000",
) -> bool:
    """Send email verification link via Mailgun.

    Args:
        recipient_email: User's email address
        recipient_name: User's display name
        verification_token: 48-char token from EmailVerification
        frontend_url: Base URL for verification link

    Returns:
        True if sent successfully, False otherwise
    """

    if not settings.MAILGUN_API_KEY or not settings.MAILGUN_DOMAIN:
        logger.warning("Mailgun credentials not configured, skipping email")
        return False

    verification_url = f"{frontend_url}/verify-email?token={verification_token}"

    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
                <h1 style="color: #333; margin-bottom: 20px;">Verify Your CampusClout Email</h1>
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                    Hi <strong>{recipient_name}</strong>,
                </p>
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                    Welcome to CampusClout! Please verify your email address to complete your registration and start earning Clout Tokens.
                </p>
                <div style="margin: 30px 0; text-align: center;">
                    <a href="{verification_url}" style="
                        background: linear-gradient(135deg, #a78bfa, #c9b8ff);
                        color: black;
                        padding: 12px 30px;
                        text-decoration: none;
                        border-radius: 6px;
                        font-weight: bold;
                        display: inline-block;
                    ">
                        Verify Email
                    </a>
                </div>
                <p style="color: #666; font-size: 14px; line-height: 1.6;">
                    Or copy this link: <br/>
                    <code style="background: #f5f5f5; padding: 10px; display: block; word-break: break-all; margin: 10px 0;">
                        {verification_url}
                    </code>
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 30px;">
                    This link expires in 24 hours. If you didn't sign up for CampusClout, please ignore this email.
                </p>
            </div>
        </body>
    </html>
    """

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.mailgun.net/v3/{settings.MAILGUN_DOMAIN}/messages",
                auth=("api", settings.MAILGUN_API_KEY),
                data={
                    "from": f"CampusClout <{settings.SENDER_EMAIL}>",
                    "to": recipient_email,
                    "subject": "Verify Your CampusClout Email",
                    "html": html_content,
                },
            )

        if response.status_code in (200, 201):
            logger.info(f"Verification email sent to {recipient_email}")
            return True
        else:
            logger.error(f"Mailgun error {response.status_code}: {response.text}")
            return False
    except Exception as e:
        logger.error(f"Failed to send verification email: {e}")
        return False


async def send_welcome_email(
    recipient_email: str,
    recipient_name: str,
) -> bool:
    """Send welcome email after successful verification."""

    if not settings.MAILGUN_API_KEY or not settings.MAILGUN_DOMAIN:
        return False

    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
                <h1 style="color: #333; margin-bottom: 20px;">Welcome to CampusClout! 🎉</h1>
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                    Hi <strong>{recipient_name}</strong>,
                </p>
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                    Your email has been verified! You're now ready to:
                </p>
                <ul style="color: #666; font-size: 16px; line-height: 2;">
                    <li>✨ Share posts and build your clout</li>
                    <li>💰 Invest in other users' profiles</li>
                    <li>🏆 Compete on leaderboards</li>
                    <li>🎯 Join the trending conversation</li>
                </ul>
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                    You started with <strong>100 Clout Tokens</strong>. Use them wisely!
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 30px;">
                    Questions? Check out our FAQ or reach out to support.
                </p>
            </div>
        </body>
    </html>
    """

    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.mailgun.net/v3/{settings.MAILGUN_DOMAIN}/messages",
                auth=("api", settings.MAILGUN_API_KEY),
                data={
                    "from": f"CampusClout <{settings.SENDER_EMAIL}>",
                    "to": recipient_email,
                    "subject": "Welcome to CampusClout!",
                    "html": html_content,
                },
            )
        return True
    except Exception as e:
        logger.error(f"Failed to send welcome email: {e}")
        return False
