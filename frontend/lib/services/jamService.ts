export class JamService {
  private socket: WebSocket | null = null;
  private sessionCode: string | null = null;

  constructor(private onEvent: (event: any) => void) {}

  connect(sessionCode: string) {
    this.sessionCode = sessionCode;
    this.socket = new WebSocket(`ws://localhost:8000/ws/jam/${sessionCode}`);
    
    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.onEvent(data);
    };
  }

  sendEvent(type: string, payload: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, ...payload }));
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
  }
}
