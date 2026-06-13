"""create_users_table

Revision ID: 000
Revises: 
Create Date: 2026-05-26 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '000'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('google_id', sa.String(length=128), nullable=True),
        sa.Column('email', sa.String(length=320), nullable=False),
        sa.Column('display_name', sa.String(length=200), nullable=True),
        sa.Column('avatar_url', sa.Text(), nullable=True),
        sa.Column('crossfade_seconds', sa.SmallInteger(), nullable=True, server_default='0'),
        sa.Column('autoplay_enabled', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_google_id'), 'users', ['google_id'], unique=True)


def downgrade():
    op.drop_index(op.f('ix_users_google_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
