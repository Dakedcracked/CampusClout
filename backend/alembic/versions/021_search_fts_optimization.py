"""Add PostgreSQL full-text search index and GIN trigram index.

Revision ID: 021
Revises: 020
Create Date: 2026-04-30
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pg_trgm extension for trigram-based similarity search
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")

    # Add tsvector column to search_index for full-text search
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Check if search_index table exists
    tables = inspector.get_table_names()
    if "search_index" in tables:
        existing_cols = {c["name"] for c in inspector.get_columns("search_index")}

        if "search_vector" not in existing_cols:
            op.add_column(
                "search_index",
                sa.Column("search_vector", sa.Text(), nullable=True),
            )

        # Create GIN index on search_text using trigrams (covers LIKE/ILIKE queries)
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("search_index")}

        if "ix_search_index_search_text_trgm" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS ix_search_index_search_text_trgm "
                "ON search_index USING gin(search_text gin_trgm_ops)"
            )

        if "ix_search_index_category_text_trgm" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS ix_search_index_category_text_trgm "
                "ON search_index USING gin((search_category || ' ' || search_text) gin_trgm_ops)"
            )

    # Add GIN trigram indexes on users table for fast username/display_name search
    if "users" in tables:
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("users")}

        if "ix_users_username_trgm" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS ix_users_username_trgm "
                "ON users USING gin(username gin_trgm_ops)"
            )

        if "ix_users_display_name_trgm" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS ix_users_display_name_trgm "
                "ON users USING gin(display_name gin_trgm_ops) WHERE display_name IS NOT NULL"
            )

    # Add indexes on posts for content search
    if "posts" in tables:
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("posts")}

        if "ix_posts_content_trgm" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS ix_posts_content_trgm "
                "ON posts USING gin(content gin_trgm_ops)"
            )

        if "ix_posts_rank_score" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS ix_posts_rank_score "
                "ON posts (rank_score DESC)"
            )

    # Add index on community_rooms name for search
    if "community_rooms" in tables:
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("community_rooms")}

        if "ix_community_rooms_name_trgm" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS ix_community_rooms_name_trgm "
                "ON community_rooms USING gin(name gin_trgm_ops)"
            )

    # Add composite index for user queries (active users sorted by market cap)
    if "clout_balances" in tables:
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("clout_balances")}

        if "ix_clout_balances_market_cap_desc" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS ix_clout_balances_market_cap_desc "
                "ON clout_balances (market_cap DESC)"
            )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_search_index_search_text_trgm")
    op.execute("DROP INDEX IF EXISTS ix_search_index_category_text_trgm")
    op.execute("DROP INDEX IF EXISTS ix_users_username_trgm")
    op.execute("DROP INDEX IF EXISTS ix_users_display_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_posts_content_trgm")
    op.execute("DROP INDEX IF EXISTS ix_posts_rank_score")
    op.execute("DROP INDEX IF EXISTS ix_community_rooms_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_clout_balances_market_cap_desc")
    op.execute("DROP COLUMN IF EXISTS search_vector FROM search_index")
