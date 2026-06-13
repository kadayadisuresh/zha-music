"""add cover_url to playlists

Revision ID: 009
Revises: 008
Create Date: 2026-06-11 11:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('playlists', sa.Column('cover_url', sa.String(), nullable=True))


def downgrade():
    op.drop_column('playlists', 'cover_url')
