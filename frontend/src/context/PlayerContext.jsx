import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSocket } from "../services/socket";

const PlayerContext = createContext(null);

function getQueryParam(name) {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  } catch {
    return null;
  }
}

export function PlayerProvider({ children, initialGuildId }) {
  const savedGuildId = (() => {
    try {
      return localStorage.getItem("selectedGuildId") || "";
    } catch {
      return "";
    }
  })();

  const [guildId, setGuildId] = useState(
    initialGuildId ||
      getQueryParam("guild_id") ||
      getQueryParam("guild") ||
      savedGuildId ||
      ""
  );
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(!!guildId);

  const [playerState, setPlayerState] = useState({
    status: "idle",
    currentTrack: null,
    queue: [],
    history: [],
    volume: 50,
    isPlaying: false,
    isShuffled: false,
    loopMode: 0
  });

  const [buffering, setBuffering] = useState(false);
  const [guilds, setGuilds] = useState([]);

  const lastPlayerUpdateRef = useRef(0);

  // Important: connect even when guildId is empty, so we can fetch the guild list.
  const socket = useMemo(() => getSocket(), []);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onDisconnect);

    socket.on("player:update", (data) => {
      const now = Date.now();
      lastPlayerUpdateRef.current = now;
      setPlayerState({
        status: data?.status || "idle",
        currentTrack: data?.currentTrack || null,
        queue: Array.isArray(data?.queue) ? data.queue : [],
        history: Array.isArray(data?.history) ? data.history : [],
        volume: typeof data?.volume === "number" ? data.volume : 50,
        isPlaying: !!data?.isPlaying,
        isShuffled: !!data?.isShuffled,
        loopMode: typeof data?.loopMode === "number" ? data.loopMode : 0
      });
      setLoading(false);
    });

    socket.on("audio:buffering", () => setBuffering(true));
    socket.on("audio:ready", () => setBuffering(false));

    socket.on("receive-guilds", (list) => {
      const next = Array.isArray(list) ? list : [];
      console.log("[dashboard] receive-guilds:", next.map((g) => g.id));
      setGuilds(next);
    });

    socket.on("connect", () => {
      console.log("[dashboard] socket connected");
      // Fetch guild list immediately on connect.
      try {
        console.log("[dashboard] requesting guild list via get-guilds");
        socket.emit("get-guilds");
      } catch {}
    });

    return () => {
      try {
        socket.off("connect", onConnect);
        socket.off("disconnect", onDisconnect);
        socket.off("connect_error", onDisconnect);
        socket.off("player:update");
        socket.off("audio:buffering");
        socket.off("audio:ready");
        socket.off("receive-guilds");
        socket.off("connect");
      } catch {}
    };
  }, [socket]);

  useEffect(() => {
    // Persist selection for refresh.
    if (!guildId) return;
    try {
      localStorage.setItem("selectedGuildId", guildId);
    } catch {}
  }, [guildId]);

  useEffect(() => {
    if (!socketConnected) return;
    if (!guilds || guilds.length === 0) return;

    // Restore from savedGuildId if present, otherwise pick first guild.
    const saved = (() => {
      try {
        return localStorage.getItem("selectedGuildId") || "";
      } catch {
        return "";
      }
    })();

    const match = saved ? guilds.find((g) => g.id === saved) : null;
    const nextGuildId = match?.id || (guildId ? guildId : guilds[0]?.id) || "";
    if (nextGuildId && nextGuildId !== guildId) {
      setGuildId(nextGuildId);
    }
    if (!guildId && guilds[0]?.id) {
      setGuildId(guilds[0].id);
    }
  }, [guilds, socketConnected]);

  useEffect(() => {
    if (!socketConnected) return;
    if (!guildId) return;
    setLoading(true);

    // Join the guild room so backend can emit `player:update` for this guild.
    socket.emit("join-guild", guildId);
    // Keep compatibility with your requested naming.
    socket.emit("dashboard:select-guild", { guildId });
  }, [guildId, socketConnected, socket]);

  const api = useMemo(() => {
    function emitEvent(event, payload = {}) {
      return new Promise((resolve) => {
        socket?.emit(event, payload, (res) => resolve(res));
      });
    }

    return {
      guildId,
      setGuildId,
      socketConnected,
      loading,
      playerState,
      buffering,
      guilds,
      refresh: () => {
        if (!guildId) return;
        socket?.emit("join-guild", guildId);
      },
      controls: {
        pause: () => emitEvent("player:pause", {}),
        skip: () => emitEvent("player:skip", {}),
        previous: () => emitEvent("player:previous", {}),
        shuffle: () => emitEvent("player:shuffle", {}),
        loop: () => emitEvent("player:loop", {}),
        setVolume: (volume) => emitEvent("player:volume", { volume }),
        seek: (positionSeconds) => emitEvent("player:seek", { positionSeconds }),
        removeTrack: (index) => emitEvent("player:removeTrack", { index }),
        clearQueue: () => emitEvent("player:clearQueue", {}),
        playTrack: (url) => emitEvent("play-track", { url }),
        playPlaylist: (name) => emitEvent("play-playlist", { name })
      }
    };
  }, [guildId, socket, socketConnected, loading, playerState, buffering, guilds]);

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

