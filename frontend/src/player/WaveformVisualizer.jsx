import React, { useMemo } from "react";

export default function WaveformVisualizer({ isPlaying }) {
  const bars = useMemo(() => {
    // Precompute baseline heights so the waveform looks "designed".
    const out = [];
    for (let i = 0; i < 60; i += 1) {
      const phase = i * 0.2;
      const base = 0.25 + (Math.sin(i * 0.35) + 1) * 0.35;
      out.push({ i, phase, base });
    }
    return out;
  }, []);

  return (
    <div className="w-full flex items-end gap-0.5 h-20 px-2">
      {bars.map((b) => (
        <div
          key={b.i}
          className={`bar-i ${isPlaying ? "" : "paused"}`}
          style={{
            width: 3,
            height: 18 + b.base * 52,
            "--i": b.i
          }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

