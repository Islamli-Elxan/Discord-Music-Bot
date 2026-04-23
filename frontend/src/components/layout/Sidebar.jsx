import React, { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  History,
  Music2,
  ListMusic,
  Search,
  Settings2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

import { usePlayer } from "../../context/PlayerContext.jsx";

const navItems = [
  { to: "/", label: "Now Playing", icon: Music2 },
  { to: "/queue", label: "Queue", icon: ListMusic },
  { to: "/search", label: "Search", icon: Search },
  { to: "/history", label: "History", icon: History },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings2 }
];

export default function Sidebar({ mobileBottom = false }) {
  const { socketConnected, guilds, guildId, setGuildId } = usePlayer();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const activeTo = useMemo(() => {
    const path = location.pathname;
    const found = navItems.find((x) => x.to === path);
    return found?.to || "/";
  }, [location.pathname]);

  const SideWrap = mobileBottom ? "fixed bottom-0 left-0 right-0" : "w-[260px]";

  return (
    <aside
      className={[
        mobileBottom
          ? "bg-bg-elevated border-t border-border-subtle backdrop-blur-md z-50"
          : "h-screen sticky top-0 bg-bg-surface border-r border-border-subtle backdrop-blur-md",
        SideWrap
      ].join(" ")}
    >
      <div className={mobileBottom ? "flex items-center justify-between px-3 py-2" : "p-4"}>
        {!mobileBottom && (
          <button
            type="button"
            aria-label="Collapse sidebar"
            onClick={() => setCollapsed((v) => !v)}
            className="text-text-secondary hover:text-text-primary transition-all duration-200"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}

        <div className={mobileBottom ? "flex-1 text-center ml-2" : "mt-2"}>
          <div
            className={[
              "inline-flex items-center gap-2",
              mobileBottom ? "justify-center" : "justify-start"
            ].join(" ")}
          >
            <span className="relative inline-flex items-center gap-1">
              <span className="hidden" />
              <span className="h-3 w-1 bg-accent-cyan-500 rounded-full animate-pulse" />
              <span className="h-3 w-1 bg-accent-cyan-400 rounded-full animate-pulse" style={{ animationDelay: "0.1s" }} />
              <span className="h-3 w-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
            </span>
            {!collapsed && !mobileBottom && (
              <span className="font-display text-sm">
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  Nicraen
                </span>
                <span className="text-text-secondary"> Bot</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {!mobileBottom && !collapsed && (
        <div className="px-4 pb-3">
          <div className="text-[10px] font-bold tracking-widest text-text-muted uppercase mb-3">Navigation</div>
        </div>
      )}

      <nav
        className={[
          mobileBottom ? "flex-1 flex" : "px-3",
          mobileBottom ? "justify-around" : "flex flex-col gap-1"
        ].join(" ")}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTo === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className={({ isActive: navActive }) =>
                [
                  "relative flex items-center gap-3 rounded-xl transition-all duration-200 ease-out cursor-pointer",
                  mobileBottom ? "justify-center px-2 py-2" : "px-3 py-2",
                  navActive ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
                ].join(" ")
              }
              end
            >
              {({ isActive: navActive }) => {
                const active = navActive || isActive;
                return (
                  <>
                    <span
                      className={[
                        "shrink-0",
                        active ? "text-accent-cyan-500" : "text-text-secondary"
                      ].join(" ")}
                    >
                      <Icon size={18} />
                    </span>
                    {!collapsed && !mobileBottom && <span className="font-medium">{item.label}</span>}
                    {active && !mobileBottom && (
                      <span className="absolute left-[-8px] top-[20%] bottom-[20%] w-[3px] rounded bg-gradient-to-b from-cyan-400 to-blue-500 shadow-[0_0_8px_var(--accent-glow)]" />
                    )}
                  </>
                );
              }}
            </NavLink>
          );
        })}
      </nav>

      <div className={mobileBottom ? "hidden" : "mt-auto p-4 pt-2"}>
        <div className="card px-3 py-3">
          <div className="text-[12px] font-bold mb-2 text-text-primary">Server</div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden flex-shrink-0">
              {(() => {
                const g = guilds.find((x) => x.id === guildId);
                const icon = g?.icon;
                return icon ? (
                  <img src={icon} alt="" className="h-full w-full object-cover" />
                ) : null;
              })()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {guilds.find((g) => g.id === guildId)?.name || guildId || "—"}
              </div>
              <div className="text-xs text-text-muted">
                Members: {guilds.find((g) => g.id === guildId)?.memberCount != null ? guilds.find((g) => g.id === guildId)?.memberCount : "—"}
              </div>
            </div>
          </div>
          <div className="mt-3">
            <select
              aria-label="Select server"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              className="w-full bg-bg-elevated border border-border-subtle rounded-lg px-2 py-2 text-text-primary text-sm"
            >
              {guilds.length === 0 ? <option value="">Select</option> : null}
              {guilds.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name || g.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
          <span className="inline-flex items-center gap-2">
            <span
              className={[
                "h-2 w-2 rounded-full",
                socketConnected ? "bg-success shadow-[0_0_8px_var(--success)]" : "bg-danger"
              ].join(" ")}
            />
            Connection
          </span>
          <span className="font-mono">{socketConnected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>
    </aside>
  );
}

