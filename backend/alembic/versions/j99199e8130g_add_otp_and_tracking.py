"""Add OTP and tracking models.

Revision ID: j99199e8130g
Revises: i89089d7029f
Create Date: 2026-05-04 19:22:13.511000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'j99199e8130g'
down_revision = 'i89089d7029f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create OTPSession table
    op.create_table(
        'otp_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(254), nullable=False),
        sa.Column('otp_code', sa.String(6), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_attempts', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_otp_sessions_email'), 'otp_sessions', ['email'], unique=False)

    # Create TrackingConsent table
    op.create_table(
        'tracking_consents',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('behavior_tracking_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('analytics_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('personalization_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('consent_version', sa.String(16), nullable=False, server_default='1.0'),
        sa.Column('consented_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )

    # Create UserTrackingEvent table
    op.create_table(
        'user_tracking_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_type', sa.Enum('PAGE_VIEW', 'PROFILE_VIEW', 'POST_VIEW', 'POST_LIKE', 'POST_UNLIKE', 
                                        'COMMENT_CREATE', 'SEARCH', 'FOLLOW', 'UNFOLLOW', 'STORY_VIEW',
                                        'CHAT_MESSAGE', 'STORE_VIEW', 'STORE_PURCHASE', 'RATE_PROFILE',
                                        name='trackingeventtype'), nullable=False),
        sa.Column('target_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('target_post_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('search_query', sa.String(255), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('device_type', sa.String(32), nullable=True),
        sa.Column('browser', sa.String(64), nullable=True),
        sa.Column('os', sa.String(64), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('country', sa.String(2), nullable=True),
        sa.Column('session_id', sa.String(64), nullable=True),
        sa.Column('time_on_page', sa.Integer(), nullable=True),
        sa.Column('event_data', sa.JSON(), nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['target_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_tracking_events_event_type'), 'user_tracking_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_user_tracking_events_user_id'), 'user_tracking_events', ['user_id'], unique=False)

    # Create UserBehaviorProfile table
    op.create_table(
        'user_behavior_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('engagement_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('activity_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('social_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('discovery_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('total_events', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('unique_days_active', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('avg_session_duration', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('peak_activity_hour', sa.Integer(), nullable=True),
        sa.Column('top_interests', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('primary_device', sa.String(32), nullable=True),
        sa.Column('device_diversity', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('primary_country', sa.String(2), nullable=True),
        sa.Column('countries_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('analyzed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )

    # Create UserInterest table
    op.create_table(
        'user_interests',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('interest_tag', sa.String(64), nullable=False),
        sa.Column('confidence_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('frequency', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('last_detected_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_interests_user_id'), 'user_interests', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_interests_user_id'), table_name='user_interests')
    op.drop_table('user_interests')
    op.drop_table('user_behavior_profiles')
    op.drop_index(op.f('ix_user_tracking_events_user_id'), table_name='user_tracking_events')
    op.drop_index(op.f('ix_user_tracking_events_event_type'), table_name='user_tracking_events')
    op.drop_table('user_tracking_events')
    op.drop_table('tracking_consents')
    op.drop_index(op.f('ix_otp_sessions_email'), table_name='otp_sessions')
    op.drop_table('otp_sessions')
