"""add_playlist_messages

Revision ID: 006
Revises: 005
Create Date: 2026-06-10 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'playlist_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('playlist_id', sa.Integer(), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('display_name', sa.String(length=200), nullable=True),
        sa.Column('avatar_url', sa.Text(), nullable=True),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['playlist_id'], ['playlists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_playlist_messages_playlist_created',
        'playlist_messages',
        ['playlist_id', 'created_at'],
    )
    op.create_index(
        op.f('ix_playlist_messages_playlist_id'),
        'playlist_messages',
        ['playlist_id'],
    )


def downgrade():
    op.drop_index(op.f('ix_playlist_messages_playlist_id'), table_name='playlist_messages')
    op.drop_index('ix_playlist_messages_playlist_created', table_name='playlist_messages')
    op.drop_table('playlist_messages')
