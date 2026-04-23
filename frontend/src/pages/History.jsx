import React, { useMemo, useState } from "react";
import { usePlayer } from "../context/PlayerContext.jsx";
import Card from "../components/ui/Card.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import Button from "../ui/Button.jsx";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatGroupLabel(date) {
  const d = startOfDay(date);
  const now = new Date();
  const today = startOfDay(now);
  const y = startOfDay(new Date(now.getTime() - 86400000));
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === y.getTime()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function downloadCsv(rows, filename) {
  const header = ["title", "artist", "playedAt", "userId"];
  const csv = [header.join(",")]
    .concat(
      rows.map((r) =>
        [r.title, r.artist, r.playedAt, r.userId || ""]
          .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function History() {
  const { loading, playerState } = usePlayer();
  const [q, setQ] = useState("");

  const history = playerState.history || [];

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    if (!nq) return history;
    return history.filter((h) => `${h.title || ""} ${h.artist || ""}`.toLowerCase().includes(nq));
  }, [history, q]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const h of filtered) {
      const dt = new Date(h.playedAt);
      const key = startOfDay(dt).getTime();
      if (!map.has(key)) map.set(key, { date: dt, items: [] });
      map.get(key).items.push(h);
    }
    return Array.from(map.values()).sort((a, b) => b.date - a.date);
  }, [filtered]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="p-6" hover={false}>
          <Skeleton className="h-8 w-64 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4" hover={false}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1">
            <div className="font-display font-bold mb-2">Listening History</div>
            <div className="text-xs text-text-muted">Reverse chronological playback</div>
          </div>
          <div className="flex items-center gap-3">
            <input
              aria-label="Filter history"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title..."
              className="bg-bg-elevated border border-border-subtle rounded-xl px-4 py-2 outline-none text-text-primary w-full md:w-64"
            />
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  history.map((h) => ({
                    title: h.title,
                    artist: h.artist,
                    playedAt: h.playedAt,
                    userId: h.requestedBy || ""
                  })),
                  "history.csv"
                )
              }
              disabled={!history.length}
            >
              Export CSV
            </Button>
          </div>
        </div>
      </Card>

      {history.length === 0 ? (
        <div className="py-14 text-center text-text-muted">
          <div className="font-display font-semibold mb-2">No history yet</div>
          <div className="text-xs">Play some tracks to start building your timeline.</div>
        </div>
      ) : (
        grouped.map((g) => (
          <Card key={g.date.getTime()} className="p-4" hover={false}>
            <div className="font-display font-bold mb-3">{formatGroupLabel(g.date)}</div>
            <div className="space-y-2">
              {g.items.map((h, idx) => (
                <div
                  key={`${h.playedAt}_${idx}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border-subtle bg-bg-elevated"
                >
                  <div className="h-10 w-10 rounded-lg bg-bg-elevated border border-border-subtle overflow-hidden shrink-0">
                    {h.albumArt || h.thumbnail ? (
                      <img src={h.albumArt || h.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{h.title || "—"}</div>
                    <div className="text-xs text-text-muted truncate">{h.artist || "—"}</div>
                  </div>
                  <div className="text-xs font-mono text-text-muted whitespace-nowrap">
                    {new Date(h.playedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

