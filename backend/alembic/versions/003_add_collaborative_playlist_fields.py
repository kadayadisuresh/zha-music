"""add_collaborative_playlist_fields

Revision ID: 003
Revises: 002
Create Date: 2026-05-26 15:55:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('playlists', sa.Column('is_collaborative', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('playlists', sa.Column('invite_token', sa.String(), nullable=True))
    op.add_column('playlists', sa.Column('invite_token_expires_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_playlists_invite_token'), 'playlists', ['invite_token'], unique=False)
    
    op.add_column('playlist_songs', sa.Column('version', sa.Integer(), nullable=False, server_default=sa.text('1')))


def downgrade():
    op.drop_index(op.f('ix_playlists_invite_token'), table_name='playlists')
    op.drop_column('playlists', 'is_collaborative')
    op.drop_column('playlists', 'invite_token')
    op.drop_column('playlists', 'invite_token_expires_at')
    
    op.drop_column('playlist_songs', 'version')
