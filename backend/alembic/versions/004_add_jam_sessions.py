"""add_jam_sessions

Revision ID: 004
Revises: 003
Create Date: 2026-05-27 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table(
        'jam_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('join_code', sa.String(length=8), nullable=False),
        sa.Column('host_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_jam_sessions_id'), 'jam_sessions', ['id'], unique=False)
    op.create_index(op.f('ix_jam_sessions_join_code'), 'jam_sessions', ['join_code'], unique=True)
    
    op.create_table(
        'jam_participants',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('jam_sessions.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('role', sa.String(length=10), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_jam_participants_id'), 'jam_participants', ['id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_jam_participants_id'), table_name='jam_participants')
    op.drop_table('jam_participants')
    op.drop_index(op.f('ix_jam_sessions_join_code'), table_name='jam_sessions')
    op.drop_index(op.f('ix_jam_sessions_id'), table_name='jam_sessions')
    op.drop_table('jam_sessions')
