import React from "react";
import { usePlayer } from "../context/PlayerContext.jsx";
import WaveformVisualizer from "../player/WaveformVisualizer.jsx";
import ProgressBar from "../player/ProgressBar.jsx";
import PlayerControls from "../player/PlayerControls.jsx";
import Card from "../components/ui/Card.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { formatTime } from "../utils/formatTime.js";
import { Link } from "react-router-dom";

function timeAgo(playedAt) {
  try {
    const t = new Date(playedAt);
    if (Number.isNaN(t.getTime())) return "";
    const sec = Math.floor((Date.now() - t.getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  } catch {
    return "";
  }
}

export default function NowPlaying() {
  const { loading, playerState, controls, buffering } = usePlayer();

  const track = playerState.currentTrack;
  const queue = playerState.queue || [];
  const history = playerState.history || [];

  const upNext = queue.slice(0, 5);
  const recent = history.slice(0, 5);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-[1fr_360px]">
        <Card className="p-6" hover={false}>
          <Skeleton className="h-10 w-48 mb-4" />
          <div className="h-96" />
        </Card>
        <Card className="p-6" hover={false}>
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  const artworkUrl = track?.albumArt || track?.thumbnail || "";

  return (
    <div className="space-y-4">
      <Card hover={true} className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-60"
          style={{
            backgroundImage: artworkUrl ? `url(${artworkUrl})` : undefined,
            transform: "scale(1.2)",
            filter: "blur(60px) brightness(0.85)"
          }}
        />
        <div className="absolute inset-0 bg-black/30 noise" />

        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-[200px] h-[200px] shrink-0">
              <div
                className={[
                  "w-full h-full rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-bg-elevated",
                  playerState.isPlaying ? "glow-pulse" : ""
                ].join(" ")}
              >
                <img
                  src={artworkUrl || undefined}
                  alt={track?.title || "Track artwork"}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold tracking-widest text-cyan-400 mb-2 uppercase">
                {playerState.isPlaying ? "CURRENTLY PLAYING" : buffering ? "BUFFERING" : "READY"}
              </div>
              <div className="font-display text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent truncate">
                {track?.title || "Nothing playing"}
              </div>
              <div className="mt-2 text-text-secondary text-lg truncate">{track?.artist || "—"}</div>
              <div className="mt-1 text-text-muted text-sm truncate">{track?.album || "—"}</div>

              <div className="mt-6">
                <WaveformVisualizer isPlaying={playerState.isPlaying && !buffering} />
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-2 text-xs text-text-muted font-mono">
                  <span>{formatTime(playerState.currentTrack?.currentTime || 0)}</span>
                  <span>{formatTime(track?.duration || 0)}</span>
                </div>
                <ProgressBar
                  currentTime={playerState.currentTrack?.currentTime || 0}
                  duration={track?.duration || 0}
                  disabled={!track}
                  onSeek={(sec) => controls.seek(sec)}
                />
              </div>

              <PlayerControls
                isPlaying={playerState.isPlaying}
                onPause={() => controls.pause()}
                onPrevious={() => controls.previous()}
                onNext={() => controls.skip()}
                onShuffle={() => controls.shuffle()}
                onLoop={() => controls.loop()}
                volume={playerState.volume}
                onSetVolume={(v) => controls.setVolume(v)}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4" hover={true}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-display font-bold">Up Next</div>
              <div className="text-text-muted text-xs">Next 5 tracks</div>
            </div>
          </div>

          {upNext.length === 0 ? (
            <div className="py-10 text-center text-text-muted">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-bg-elevated border border-border-subtle flex items-center justify-center mb-3">
                <span className="text-cyan-400">♫</span>
              </div>
              <div className="font-display font-semibold">Queue is empty</div>
              <div className="text-xs mt-1">Add a track to start autoplay recommendations.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {upNext.map((t, idx) => {
                const absoluteIndex = idx;
                return (
                  <div
                    key={t?.url || `${t?.title}_${idx}`}
                    className="group flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-border-subtle transition-all"
                  >
                    <div className="w-8 text-xs text-text-muted font-mono">{idx + 1}</div>
                    <div className="h-10 w-10 rounded-lg bg-bg-elevated border border-border-subtle overflow-hidden shrink-0">
                      <img
                        src={t?.albumArt || t?.thumbnail || ""}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{t?.title || "—"}</div>
                      <div className="text-xs text-text-muted truncate">{t?.artist || "—"}</div>
                    </div>
                    <div className="text-xs text-text-muted font-mono">{formatTime(t?.duration || 0)}</div>
                    <button
                      type="button"
                      aria-label="Remove from queue"
                      onClick={() => controls.removeTrack(absoluteIndex)}
                      className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-text-primary"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              <div className="mt-4 text-right">
                <Link to="/queue" className="text-sm text-cyan-400 hover:text-blue-500 font-semibold">
                  View Full Queue →
                </Link>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4" hover={true}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-display font-bold">Recently Played</div>
              <div className="text-text-muted text-xs">Last 5 tracks</div>
            </div>
          </div>
          {recent.length === 0 ? (
            <div className="py-10 text-center text-text-muted">
              <div className="font-display font-semibold">No history yet</div>
              <div className="text-xs mt-1">Play something to populate your listening timeline.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((h, idx) => (
                <div
                  key={h?.url || `${h?.title}_${idx}`}
                  className="flex items-center gap-3 p-2 rounded-xl border border-border-subtle bg-bg-elevated"
                  style={{
                    borderLeft: `3px solid rgba(6,182,212,${0.35 - idx * 0.05})`
                  }}
                >
                  <div className="h-10 w-10 rounded-lg bg-bg-elevated border border-border-subtle overflow-hidden shrink-0">
                    <img
                      src={h?.albumArt || h?.thumbnail || ""}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{h?.title || "—"}</div>
                    <div className="text-xs text-text-muted truncate">{h?.artist || "—"}</div>
                  </div>
                  <div className="text-xs text-text-muted font-mono">{timeAgo(h?.playedAt)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

