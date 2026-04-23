import React, { useEffect, useMemo, useState } from "react";
import { usePlayer } from "../context/PlayerContext.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../ui/Button.jsx";
import { getSocket } from "../services/socket.js";
import { useToasts } from "../context/ToastContext.jsx";
import Toggle from "../ui/Toggle.jsx";
import Slider from "../ui/Slider.jsx";
import { fetchAutoplaySettings, fetchEqPreset } from "../services/api.js";

const MODES = [
  { id: "smart", label: "Smart" },
  { id: "similar_artist", label: "Similar Artist" },
  { id: "same_genre", label: "Same Genre" },
  { id: "random", label: "Random (fallback)" }
];

const EQ_PRESETS = ["flat", "bassboost", "nightcore", "vaporwave", "podcast"];

function AccordionSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border-subtle rounded-2xl bg-bg-elevated">
      <button
        type="button"
        aria-label={`Toggle ${title}`}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="font-display font-bold">{title}</div>
        <div className="text-text-muted">{open ? "—" : "+"}</div>
      </button>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}

export default function Settings() {
  const { guildId, controls, playerState } = usePlayer();
  const { pushToast } = useToasts();
  const socket = useMemo(() => getSocket(), []);

  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [autoplayMode, setAutoplayMode] = useState("smart");
  const [explorationRate, setExplorationRate] = useState(20);
  const [blockExplicit, setBlockExplicit] = useState(true);

  const [eqPreset, setEqPreset] = useState("flat");

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!guildId) return;
      try {
        const [autoRes, eqRes] = await Promise.all([fetchAutoplaySettings(guildId), fetchEqPreset(guildId)]);
        if (!alive) return;
        if (autoRes?.enabled != null) setAutoplayEnabled(!!autoRes.enabled);
        if (autoRes?.settings?.mode) setAutoplayMode(autoRes.settings.mode);
        if (autoRes?.settings?.exploration_rate != null)
          setExplorationRate(Number(autoRes.settings.exploration_rate) || 20);
        if (autoRes?.settings?.block_explicit != null)
          setBlockExplicit(!!autoRes.settings.block_explicit);
        if (eqRes?.preset) setEqPreset(eqRes.preset);
      } catch (e) {
        if (!alive) return;
        pushToast({ type: "error", title: "Settings load failed", message: e?.message || String(e) });
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [guildId]);

  async function applyAutoplay() {
    if (!guildId) return;
    socket.emit(
      "settings:autoplay",
      {
        guildId,
        enabled: autoplayEnabled,
        mode: autoplayMode,
        exploration_rate: explorationRate,
        block_explicit: blockExplicit,
        preferred_sources: "both"
      },
      (res) => {
        if (res?.error) pushToast({ type: "error", title: "Autoplay update failed", message: res.error });
        else pushToast({ type: "success", title: "Autoplay updated", message: "Settings saved." });
      }
    );
  }

  function applyEq() {
    if (!guildId) return;
    socket.emit(
      "audio:eq",
      { guildId, preset: eqPreset },
      (res) => {
        if (res?.error) pushToast({ type: "error", title: "EQ update failed", message: res.error });
        else pushToast({ type: "success", title: "EQ applied", message: eqPreset });
      }
    );
  }

  return (
    <div className="space-y-4">
      <AccordionSection title="🔊 Audio" defaultOpen>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-display font-bold">Default Volume</div>
              <div className="text-xs text-text-muted">Applies to playback immediately</div>
            </div>
            <div className="text-text-muted font-mono text-sm">{playerState.volume}%</div>
          </div>
          <Slider
            value={playerState.volume}
            min={0}
            max={100}
            onChange={(v) => controls.setVolume(v)}
            ariaLabel="Volume"
          />

          <div className="pt-2">
            <div className="font-display font-bold mb-2">EQ Preset</div>
            <div className="flex flex-wrap gap-2">
              {EQ_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-label={`EQ preset ${p}`}
                  onClick={() => setEqPreset(p)}
                  className={[
                    "px-3 py-1 rounded-full border transition-all duration-200",
                    eqPreset === p
                      ? "border-border-active bg-bg-elevated shadow-[0_0_24px_var(--accent-glow)]"
                      : "border-border-subtle hover:border-border-active"
                  ].join(" ")}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <Button variant="primary" onClick={applyEq}>
                Apply EQ
              </Button>
            </div>
          </div>
        </div>
      </AccordionSection>

      <AccordionSection title="🤖 Bot Behavior" defaultOpen>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display font-bold">Smart Autoplay</div>
              <div className="text-xs text-text-muted">Use recommendation engine when queue ends</div>
            </div>
            <Toggle checked={autoplayEnabled} onChange={setAutoplayEnabled} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display font-bold">Mode</div>
              <div className="text-xs text-text-muted">Smart / Similar / Genre / Random</div>
            </div>
            <select
              className="bg-bg-elevated border border-border-subtle rounded-xl px-3 py-2 text-text-primary outline-none"
              value={autoplayMode}
              onChange={(e) => setAutoplayMode(e.target.value)}
              aria-label="Autoplay mode"
            >
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="font-display font-bold">Exploration rate</div>
              <div className="font-mono text-text-muted">{explorationRate}%</div>
            </div>
            <Slider value={explorationRate} min={0} max={100} onChange={setExplorationRate} ariaLabel="Exploration rate" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display font-bold">Block Explicit</div>
              <div className="text-xs text-text-muted">Heuristic based on track text</div>
            </div>
            <Toggle checked={blockExplicit} onChange={setBlockExplicit} />
          </div>

          <div className="pt-2">
            <Button variant="primary" onClick={applyAutoplay}>
              Save Autoplay Settings
            </Button>
          </div>
        </div>
      </AccordionSection>
    </div>
  );
}

