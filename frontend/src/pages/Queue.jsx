import React, { useMemo, useState } from "react";
import { usePlayer } from "../context/PlayerContext.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { formatTime } from "../utils/formatTime.js";

export default function Queue() {
  const { loading, playerState, controls } = usePlayer();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set());

  const queue = playerState.queue || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter((t) => {
      const hay = `${t?.title || ""} ${t?.artist || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [queue, query]);

  const selectedCount = selected.size;

  async function bulkRemove() {
    if (!selectedCount) return;
    // Remove in descending order to keep indexes stable.
    const idxs = Array.from(selected).sort((a, b) => b - a);
    for (const idx of idxs) {
      // eslint-disable-next-line no-await-in-loop
      await controls.removeTrack(idx);
    }
    setSelected(new Set());
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="p-6" hover={false}>
          <Skeleton className="h-8 w-56 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4" hover={true}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <input
              aria-label="Search queue"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search in queue..."
              className="flex-1 bg-bg-elevated border border-border-subtle rounded-xl px-4 py-2 outline-none text-text-primary"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => controls.shuffle()}>
              Shuffle Queue
            </Button>
            <Button variant="danger" className="bg-danger/10 border border-danger/30 text-danger hover:border-danger" onClick={() => controls.clearQueue()}>
              Clear All
            </Button>
          </div>
        </div>
      </Card>

      {selectedCount > 0 ? (
        <Card className="p-3" hover={true}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm text-text-secondary">
              Selected: <span className="text-text-primary font-bold">{selectedCount}</span>
            </div>
            <div className="flex gap-3">
              <Button variant="danger" onClick={bulkRemove}>
                Remove Selected
              </Button>
              <Button variant="secondary" onClick={() => setSelected(new Set())}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {filtered.length === 0 ? (
        <div className="py-14 text-center text-text-muted">
          <div className="font-display font-semibold mb-2">Queue is empty</div>
          <div className="text-xs">Add tracks from Search or Playlists.</div>
        </div>
      ) : (
        <Card className="p-0 overflow-hidden" hover={false}>
          <div className="grid grid-cols-[44px_1fr_120px_44px] gap-0 text-xs text-text-muted px-4 py-3 border-b border-border-subtle font-bold">
            <div />
            <div>Title</div>
            <div>Duration</div>
            <div />
          </div>

          <div className="divide-y divide-border-subtle">
            {filtered.map((t, i) => {
              // i is relative index; need absolute index in queue for backend removal.
              const absoluteIndex = queue.indexOf(t);
              const isChecked = selected.has(absoluteIndex);
              return (
                <div
                  key={t?.url || `${t?.title}_${absoluteIndex}`}
                  className="group grid grid-cols-[44px_1fr_120px_44px] gap-0 items-center px-4 py-3 hover:bg-white/5 transition-all"
                >
                  <div className="flex items-center justify-center">
                    <input
                      aria-label={`Select queue item ${i + 1}`}
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(absoluteIndex);
                          else next.delete(absoluteIndex);
                          return next;
                        });
                      }}
                      className="accent-cyan-500"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{t?.title || "—"}</div>
                    <div className="text-xs text-text-muted truncate">{t?.artist || "—"}</div>
                  </div>
                  <div className="text-xs text-text-muted font-mono text-right pr-2">{formatTime(t?.duration || 0)}</div>
                  <div className="text-right">
                    <button
                      type="button"
                      aria-label="Remove track"
                      onClick={() => controls.removeTrack(absoluteIndex)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-text-primary"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

