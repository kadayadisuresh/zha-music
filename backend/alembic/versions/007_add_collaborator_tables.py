"""add_playlist_collaborators_and_invite_tokens

Revision ID: 007
Revises: 006
Create Date: 2026-06-11 09:00:00.000000

Note: is_collaborative + version columns were already added in migration 003.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'playlist_collaborators',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('playlist_id', sa.Integer(), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False, server_default='editor'),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['playlist_id'], ['playlists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('playlist_id', 'user_id', name='uq_playlist_collaborator'),
    )
    op.create_index(op.f('ix_playlist_collaborators_playlist_id'), 'playlist_collaborators', ['playlist_id'])
    op.create_index(op.f('ix_playlist_collaborators_user_id'), 'playlist_collaborators', ['user_id'])

    op.create_table(
        'playlist_invite_tokens',
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('playlist_id', sa.Integer(), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['playlist_id'], ['playlists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('token'),
    )
    op.create_index(op.f('ix_playlist_invite_tokens_playlist_id'), 'playlist_invite_tokens', ['playlist_id'])


def downgrade():
    op.drop_index(op.f('ix_playlist_invite_tokens_playlist_id'), table_name='playlist_invite_tokens')
    op.drop_table('playlist_invite_tokens')
    op.drop_index(op.f('ix_playlist_collaborators_user_id'), table_name='playlist_collaborators')
    op.drop_index(op.f('ix_playlist_collaborators_playlist_id'), table_name='playlist_collaborators')
    op.drop_table('playlist_collaborators')
