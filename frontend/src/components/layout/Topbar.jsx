import React, { useMemo } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { useLocation } from "react-router-dom";
import { usePlayer } from "../../context/PlayerContext.jsx";

const titles = {
  "/": "Now Playing",
  "/queue": "Queue",
  "/search": "Search",
  "/history": "History",
  "/analytics": "Analytics",
  "/settings": "Settings"
};

export default function Topbar() {
  const { socketConnected, guildId, setGuildId, guilds } = usePlayer();
  const location = useLocation();

  const title = useMemo(() => titles[location.pathname] || "Dashboard", [location.pathname]);
  const crumbs = useMemo(() => ["Nicraen", title], [title]);

  return (
    <div className="sticky top-0 z-40 bg-bg-overlay backdrop-blur-md border-b border-border-subtle">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs text-text-muted font-bold tracking-widest uppercase mb-1">
            {crumbs.join(" / ")}
          </div>
          <div className="font-display text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            {title}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:block text-xs text-text-muted">
            <span className="inline-flex items-center gap-2">
              <span
                className={[
                  "h-2 w-2 rounded-full",
                  socketConnected ? "bg-success shadow-[0_0_8px_var(--success)]" : "bg-danger"
                ].join(" ")}
              />
              {socketConnected ? "Live" : "Offline"}
            </span>
          </div>

          <div className="relative">
            <select
              aria-label="Select server"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              className="bg-bg-elevated border border-border-subtle text-text-primary rounded-lg px-3 py-2 text-sm pr-8 outline-none"
            >
              <option value="">Server</option>
              {guilds.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name || g.id}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"
              size={16}
            />
          </div>

          <button
            type="button"
            aria-label="Notifications"
            className="h-10 w-10 rounded-xl bg-bg-elevated border border-border-subtle hover:border-border-active hover:shadow-[0_0_24px_var(--accent-glow)] transition-all duration-200 flex items-center justify-center"
          >
            <Bell size={18} className="text-text-secondary" />
          </button>

          <div className="h-10 w-10 rounded-xl bg-bg-elevated border border-border-subtle" aria-label="User avatar" />
        </div>
      </div>
    </div>
  );
}

