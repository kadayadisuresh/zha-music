"""add jam playback state columns + jam_invite_tokens

Revision ID: 008
Revises: 007
Create Date: 2026-06-11 10:00:00.000000

jam_sessions + jam_participants already exist (id/join_code/host_id and
id/session_id/user_id/role respectively). This adds the playback-state columns
the Jam hub needs, a joined_at to participants, and the invite-token table.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    # --- jam_sessions: playback state ---------------------------------------
    op.add_column('jam_sessions', sa.Column('current_track_id', sa.String(length=32), nullable=True))
    op.add_column('jam_sessions', sa.Column('current_position_ms', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('jam_sessions', sa.Column('is_playing', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('jam_sessions', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('jam_sessions', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')))

    # --- jam_participants: joined_at + indexes + uniqueness -----------------
    op.add_column('jam_participants', sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()')))
    op.create_index(op.f('ix_jam_participants_session_id'), 'jam_participants', ['session_id'])
    op.create_index(op.f('ix_jam_participants_user_id'), 'jam_participants', ['user_id'])
    op.create_unique_constraint('uq_jam_participant', 'jam_participants', ['session_id', 'user_id'])

    # --- jam_invite_tokens (new) --------------------------------------------
    op.create_table(
        'jam_invite_tokens',
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['jam_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('token'),
    )
    op.create_index(op.f('ix_jam_invite_tokens_session_id'), 'jam_invite_tokens', ['session_id'])


def downgrade():
    op.drop_index(op.f('ix_jam_invite_tokens_session_id'), table_name='jam_invite_tokens')
    op.drop_table('jam_invite_tokens')
    op.drop_constraint('uq_jam_participant', 'jam_participants', type_='unique')
    op.drop_index(op.f('ix_jam_participants_user_id'), table_name='jam_participants')
    op.drop_index(op.f('ix_jam_participants_session_id'), table_name='jam_participants')
    op.drop_column('jam_participants', 'joined_at')
    op.drop_column('jam_sessions', 'created_at')
    op.drop_column('jam_sessions', 'is_active')
    op.drop_column('jam_sessions', 'is_playing')
    op.drop_column('jam_sessions', 'current_position_ms')
    op.drop_column('jam_sessions', 'current_track_id')
