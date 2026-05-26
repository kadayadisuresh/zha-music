import { io, Socket } from 'socket.io-client';

class PlaylistSyncService {
  private socket: Socket | null = null;
  private roomId: string | null = null;

  connect(roomId: string, userId: string, username: string) {
    this.roomId = roomId;
    this.socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000', {
      query: { roomId, userId, username }
    });

    this.socket.on('connect', () => {
      console.log('Connected to playlist room:', roomId);
    });

    this.socket.on('presence_update', (users: { userId: string; username: string }[]) => {
      // Logic for handling presence updates
      console.log('Presence update:', users);
    });
  }

  emitUpdate(type: string, data: any) {
    if (this.socket) {
      this.socket.emit('playlist_update', { type, data });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const playlistSyncService = new PlaylistSyncService();
