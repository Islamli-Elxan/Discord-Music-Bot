import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

let socket = null;

export function getSocket() {
  if (socket) return socket;
  socket = io(BACKEND_URL, {
    transports: ["websocket"],
    withCredentials: true,
    reconnection: true,
    timeout: 10000
  });
  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  try {
    socket.disconnect();
  } catch {}
  socket = null;
}

