"""add_playlist_tables

Revision ID: 001
Revises: 
Create Date: 2026-05-26 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = '000'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'playlists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_playlists_id'), 'playlists', ['id'], unique=False)
    
    op.create_table(
        'playlist_songs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('playlist_id', sa.Integer(), nullable=False),
        sa.Column('song_id', sa.String(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['playlist_id'], ['playlists.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_playlist_songs_id'), 'playlist_songs', ['id'], unique=False)


def downgrade():
    op.drop_table('playlist_songs')
    op.drop_table('playlists')
