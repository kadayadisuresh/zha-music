"""add_blend_tables

Revision ID: 005
Revises: 004
Create Date: 2026-05-27 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'blends',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user1_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user2_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user1_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['user2_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table(
        'blend_invites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('from_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('to_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['from_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['to_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('blend_invites')
    op.drop_table('blends')
