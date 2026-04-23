import React from "react";
import { Repeat, Shuffle, SkipBack, SkipForward, PauseCircle, PlayCircle, RotateCcw } from "lucide-react";
import Button from "../ui/Button.jsx";

function ControlIconButton({ ariaLabel, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="h-16 w-16 rounded-full bg-[var(--gradient-primary)] text-white shadow-[0_0_32px_var(--accent-glow)] hover:shadow-[0_0_48px_var(--accent-glow)] transition-all duration-200 ease-out flex items-center justify-center"
    >
      {children}
    </button>
  );
}

export default function PlayerControls({ isPlaying, onPause, onPrevious, onNext, onShuffle, onLoop, volume = 50, onSetVolume }) {
  return (
    <div className="flex items-center justify-center gap-5 mt-4">
      <button
        type="button"
        aria-label="Shuffle"
        onClick={onShuffle}
        className="h-12 w-12 rounded-xl bg-bg-elevated border border-border-subtle hover:border-border-active hover:shadow-[0_0_24px_var(--accent-glow)] transition-all duration-200 flex items-center justify-center"
      >
        <Shuffle size={18} className="text-cyan-400" />
      </button>

      <button
        type="button"
        aria-label="Previous"
        onClick={onPrevious}
        className="h-12 w-12 rounded-xl bg-bg-elevated border border-border-subtle hover:border-border-active hover:shadow-[0_0_24px_var(--accent-glow)] transition-all duration-200 flex items-center justify-center"
      >
        <SkipBack size={18} className="text-cyan-400" />
      </button>

      <ControlIconButton ariaLabel={isPlaying ? "Pause" : "Play"} onClick={onPause}>
        {isPlaying ? <PauseCircle size={30} /> : <PlayCircle size={30} />}
      </ControlIconButton>

      <button
        type="button"
        aria-label="Next"
        onClick={onNext}
        className="h-12 w-12 rounded-xl bg-bg-elevated border border-border-subtle hover:border-border-active hover:shadow-[0_0_24px_var(--accent-glow)] transition-all duration-200 flex items-center justify-center"
      >
        <SkipForward size={18} className="text-cyan-400" />
      </button>

      <button
        type="button"
        aria-label="Repeat"
        onClick={onLoop}
        className="h-12 w-12 rounded-xl bg-bg-elevated border border-border-subtle hover:border-border-active hover:shadow-[0_0_24px_var(--accent-glow)] transition-all duration-200 flex items-center justify-center"
      >
        <RotateCcw size={18} className="text-cyan-400" />
      </button>

      <div className="hidden lg:flex items-center gap-3 ml-6 w-[240px]">
        <div className="text-text-muted text-sm w-10 text-right">Vol</div>
        <input
          aria-label="Volume"
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => onSetVolume?.(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

