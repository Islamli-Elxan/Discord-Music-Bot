import React, { useEffect, useMemo, useState } from "react";
import { usePlayer } from "../context/PlayerContext.jsx";
import { getSocket } from "../services/socket";
import Card from "../components/ui/Card.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import Button from "../ui/Button.jsx";
import { Play } from "lucide-react";

function debounce(fn, delayMs) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), delayMs);
  };
}

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

export default function Search() {
  const { loading, playerState, controls, guildId, socketConnected } = usePlayer();
  const history = playerState.history || [];

  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [playlistTracks, setPlaylistTracks] = useState({ electro: [], rock: [] });

  useEffect(() => {
    if (!socketConnected) return;
    const socket = getSocket();
    const names = ["electro", "rock"];
    names.forEach((name) => {
      socket.emit("get-playlist-tracks", { name }, (res) => {
        setPlaylistTracks((prev) => ({
          ...prev,
          [name]: res?.tracks || []
        }));
      });
    });
  }, [socketConnected]);

  const historyMatches = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    return history.filter((h) => normalize(`${h.title} ${h.artist}`).includes(q)).slice(0, 5);
  }, [history, query]);

  useEffect(() => {
    if (!socketConnected) return;
    const socket = getSocket();

    const doSearch = async (q) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setTracks([]);
        setSearching(false);
        setError("");
        return;
      }
      setSearching(true);
      setError("");
      try {
        socket.emit("search", { query: trimmed }, (res) => {
          if (res?.error) {
            setError(res.error);
            setTracks([]);
            setSearching(false);
            return;
          }
          setTracks(res?.results || []);
          setSearching(false);
        });
      } catch (e) {
        setError(e?.message || "Search failed");
        setSearching(false);
      }
    };

    const handler = debounce((q) => doSearch(q), 300);
    handler(query);
    return () => {};
  }, [query, socketConnected]);

  return (
    <div className="space-y-4">
      <Card className="p-4" hover={false}>
        <div className="flex items-center gap-3">
          <input
            aria-label="Search tracks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks, artists, playlists..."
            className="flex-1 bg-bg-elevated border border-border-subtle rounded-xl px-4 py-3 outline-none text-text-primary"
          />
          <Button variant="secondary" onClick={() => setQuery("")}>
            Clear
          </Button>
        </div>
      </Card>

      {error ? (
        <div className="text-danger text-sm">{error}</div>
      ) : null}

      {searching ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <Card className="p-4" hover={false}>
              <div className="font-display font-bold mb-3">Tracks</div>
              {tracks.length === 0 ? (
                <div className="py-10 text-center text-text-muted text-sm">No track results.</div>
              ) : (
                <div className="space-y-2">
                  {tracks.map((t, idx) => (
                    <div
                      key={t?.url || idx}
                      className="flex items-center gap-3 p-2 rounded-xl border border-border-subtle bg-bg-elevated"
                    >
                      <div className="h-10 w-10 rounded-lg bg-bg-base overflow-hidden border border-border-subtle shrink-0">
                        {t?.albumArt ? (
                          <img src={t.albumArt} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{t.title || "—"}</div>
                        <div className="text-xs text-text-muted truncate">{t.artist || "—"}</div>
                      </div>
                      <Button
                        onClick={() => controls.playTrack(t.url)}
                        variant="primary"
                        className="h-10 w-10 rounded-xl"
                        aria-label="Play track now"
                      >
                        <Play size={18} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4" hover={false}>
              <div className="font-display font-bold mb-3">From History</div>
              {historyMatches.length === 0 ? (
                <div className="py-10 text-center text-text-muted text-sm">No history matches.</div>
              ) : (
                <div className="space-y-2">
                  {historyMatches.map((h, idx) => (
                    <div
                      key={h?.url || idx}
                      className="flex items-center justify-between gap-3 p-2 rounded-xl border border-border-subtle bg-bg-elevated"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{h.title || "—"}</div>
                        <div className="text-xs text-text-muted truncate">{h.artist || "—"}</div>
                      </div>
                      <Button variant="secondary" onClick={() => controls.playTrack(h.url)} disabled={!h.url}>
                        Play
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-4" hover={false}>
              <div className="font-display font-bold mb-3">Playlists</div>
              <div className="space-y-2">
                {["electro", "rock"].map((name) => (
                  <div
                    key={name}
                    className="p-3 rounded-xl border border-border-subtle bg-bg-elevated"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold capitalize">{name} mix</div>
                        <div className="text-xs text-text-muted">{playlistTracks[name]?.length || 0} tracks</div>
                      </div>
                      <Button variant="primary" onClick={() => controls.playPlaylist(name)}>
                        Play
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

