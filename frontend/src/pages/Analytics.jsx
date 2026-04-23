import React, { useEffect, useMemo, useState } from "react";
import { usePlayer } from "../context/PlayerContext.jsx";
import Card from "../components/ui/Card.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { fetchAnalyticsSummary, fetchAnalyticsDaily, fetchAnalyticsTopTracks, fetchAnalyticsGenres, fetchAnalyticsHeatmap } from "../services/api.js";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { useToasts } from "../context/ToastContext.jsx";
import CountUp from "react-countup";

export default function Analytics() {
  const { guildId, loading } = usePlayer();
  const { pushToast } = useToasts();

  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState(null);
  const [topTracks, setTopTracks] = useState(null);
  const [genres, setGenres] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!guildId) return;
      setLoadingData(true);
      try {
        const [s, d, t, g, h] = await Promise.all([
          fetchAnalyticsSummary(guildId),
          fetchAnalyticsDaily(guildId),
          fetchAnalyticsTopTracks(guildId).catch(() => ({ tracks: [] })),
          fetchAnalyticsGenres(guildId).catch(() => ({ genres: [] })),
          fetchAnalyticsHeatmap(guildId).catch(() => ({ heatmap: [] }))
        ]);
        if (!alive) return;
        setSummary(s?.summary || s);
        setDaily(d?.daily || d);
        setTopTracks(t?.topTracks || t);
        setGenres(g?.genres || g);
        setHeatmap(h?.heatmap || h);
      } catch (e) {
        pushToast({ type: "error", title: "Analytics failed", message: e?.message || String(e) });
      } finally {
        if (alive) setLoadingData(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [guildId]);

  const genreCells = useMemo(() => {
    const list = genres?.genres || genres?.items || genres || [];
    if (!Array.isArray(list)) return [];
    const colors = ["#06b6d4", "#3b82f6", "#2563eb", "#22d3ee", "#10b981", "#f59e0b", "#ef4444"];
    return list.slice(0, 8).map((g, idx) => ({ ...g, color: colors[idx % colors.length] }));
  }, [genres]);

  if (loading || loadingData) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4" hover={false}>
              <Skeleton className="h-5 w-32 mb-3" />
              <Skeleton className="h-10 w-24" />
            </Card>
          ))}
        </div>
        <Card className="p-4" hover={false}>
          <Skeleton className="h-72 w-full" />
        </Card>
      </div>
    );
  }

  const totalTracks = summary?.totalTracks ?? summary?.total_tracks ?? 0;
  const hoursListened = summary?.hoursListened ?? 0;

  const dailySeries = Array.isArray(daily?.series) ? daily.series : daily?.dailySeries || [];

  const heat = heatmap?.grid || heatmap?.heatmap || [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4" hover={true}>
          <div className="text-xs text-text-muted font-bold uppercase">Total Tracks</div>
          <div className="mt-2 text-3xl font-display font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            <CountUp end={Number(totalTracks) || 0} duration={1.2} />
          </div>
        </Card>
        <Card className="p-4" hover={true}>
          <div className="text-xs text-text-muted font-bold uppercase">Hours Listened</div>
          <div className="mt-2 text-3xl font-display font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            <CountUp end={Number(hoursListened) || 0} decimals={1} duration={1.2} />
          </div>
        </Card>
        <Card className="p-4" hover={true}>
          <div className="text-xs text-text-muted font-bold uppercase">Top Listener</div>
          <div className="mt-2 text-sm text-text-secondary">
            {summary?.topListener?.userId ? <span className="font-bold">{summary.topListener.userId}</span> : "—"}
          </div>
        </Card>
        <Card className="p-4" hover={true}>
          <div className="text-xs text-text-muted font-bold uppercase">Fav Genre</div>
          <div className="mt-2 text-sm text-text-secondary">
            {summary?.favGenre?.genre || summary?.favoriteGenre || "—"}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4" hover={false}>
          <div className="font-display font-bold mb-3">Listening Activity (7 days)</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCyanBlue" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="rgba(122,164,196,0.7)" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "rgba(10,22,40,0.95)", border: "1px solid rgba(6,182,212,0.15)", borderRadius: 12 }}
                />
                <Area type="monotone" dataKey="tracks" stroke="url(#gradCyanBlue)" fill="url(#gradCyanBlue)" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4" hover={false}>
          <div className="font-display font-bold mb-3">Genre Distribution</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genreCells}
                  dataKey="count"
                  nameKey="genre"
                  outerRadius={90}
                  innerRadius={45}
                  label={({ percent }) => `${Math.round(percent * 100)}%`}
                >
                  {genreCells.map((c, idx) => (
                    <Cell key={`${c.genre}_${idx}`} fill={c.color || "#06b6d4"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-4" hover={false}>
        <div className="font-display font-bold mb-3">Peak Hours Heatmap</div>
        <div className="grid grid-cols-[110px_24px_repeat(24,1fr)] gap-1 text-xs">
          {/* Header row */}
          <div className="text-text-muted font-bold" />
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="text-text-muted text-center font-mono">
              {h}
            </div>
          ))}

          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, dayIdx) => (
            <React.Fragment key={d}>
              <div className="text-text-muted font-bold pt-1">{d}</div>
              {Array.from({ length: 24 }).map((_, hour) => {
                const count = heat?.[dayIdx]?.[hour] ?? 0;
                const alpha = Math.min(0.9, count / 10);
                const bg = `rgba(6,182,212,${alpha * 0.6})`;
                return (
                  <div
                    key={`${dayIdx}_${hour}`}
                    title={`${d} ${hour}:00 - ${count} tracks`}
                    className="h-6 rounded-md border border-[rgba(6,182,212,0.12)]"
                    style={{ background: bg }}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </Card>
    </div>
  );
}

