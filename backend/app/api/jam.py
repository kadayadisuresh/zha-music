from fastapi import WebSocket, WebSocketDisconnect, HTTPException, status
from typing import Dict, List, Set
import json
import logging

logger = logging.getLogger(__name__)

class JamManager:
    def __init__(self):
        # session_code -> set of active WebSockets
        self.active_sessions: Dict[str, Set[WebSocket]] = {}
        # session_code -> participant data (simplified for now)
        self.participants: Dict[str, List[dict]] = {}

    async def connect(self, websocket: WebSocket, session_code: str):
        await websocket.accept()
        if session_code not in self.active_sessions:
            self.active_sessions[session_code] = set()
            self.participants[session_code] = []
        
        self.active_sessions[session_code].add(websocket)
        logger.info(f"Client connected to session {session_code}")

    def disconnect(self, websocket: WebSocket, session_code: str):
        if session_code in self.active_sessions:
            self.active_sessions[session_code].remove(websocket)
            if not self.active_sessions[session_code]:
                del self.active_sessions[session_code]
                if session_code in self.participants:
                    del self.participants[session_code]
        logger.info(f"Client disconnected from session {session_code}")

    async def broadcast(self, session_code: str, message: dict, sender: WebSocket = None):
        if session_code in self.active_sessions:
            for connection in self.active_sessions[session_code]:
                if connection != sender:
                    await connection.send_json(message)

    async def handle_event(self, websocket: WebSocket, session_code: str, event: dict):
        event_type = event.get("type")
        logger.info(f"Handling event {event_type} in session {session_code}")
        
        # 9 Required events: join, leave, play, pause, seek, next, queue_add, sync_state, end
        if event_type == "join":
            # Add participant
            pass
        elif event_type == "leave":
            pass
        elif event_type in ["play", "pause", "seek", "next", "queue_add", "sync_state", "end"]:
            # Broadcast all these events to others
            await self.broadcast(session_code, event, sender=websocket)
        else:
            logger.warning(f"Unknown event type: {event_type}")

jam_manager = JamManager()
