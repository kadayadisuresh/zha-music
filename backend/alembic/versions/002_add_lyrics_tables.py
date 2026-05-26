"""add_lyrics_tables

Revision ID: 002
Revises: 001
Create Date: 2026-05-26 15:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table(
        'lyrics_sync_offset',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('video_id', sa.String(), nullable=False),
        sa.Column('offset_seconds', sa.Float(), nullable=False, server_default='0.0'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_lyrics_sync_offset_id'), 'lyrics_sync_offset', ['id'], unique=False)
    op.create_index(op.f('ix_lyrics_sync_offset_video_id'), 'lyrics_sync_offset', ['video_id'], unique=True)


def downgrade():
    op.drop_table('lyrics_sync_offset')
