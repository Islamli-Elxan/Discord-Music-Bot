import React, { useEffect, useMemo, useRef, useState } from "react";

export default function ProgressBar({ currentTime = 0, duration = 0, onSeek, disabled = false }) {
  const [dragging, setDragging] = useState(false);
  const dragRaf = useRef(null);

  const safeDuration = useMemo(() => Math.max(0, Number(duration) || 0), [duration]);
  const safeCurrent = useMemo(() => Math.max(0, Number(currentTime) || 0), [currentTime]);

  const percent = safeDuration > 0 ? Math.min(100, (safeCurrent / safeDuration) * 100) : 0;

  function clientXToSeconds(clientX, barEl) {
    const rect = barEl.getBoundingClientRect();
    const x = Math.min(rect.right, Math.max(rect.left, clientX));
    const p = rect.width > 0 ? (x - rect.left) / rect.width : 0;
    const seconds = Math.round(p * safeDuration);
    return Math.max(0, Math.min(safeDuration, seconds));
  }

  const rangeRef = useRef(null);

  function handlePointerDown(e) {
    if (disabled) return;
    const el = rangeRef.current;
    if (!el) return;
    setDragging(true);
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {}

    const seconds = clientXToSeconds(e.clientX, el);
    onSeek?.(seconds);
  }

  function handlePointerMove(e) {
    if (!dragging) return;
    const el = rangeRef.current;
    if (!el) return;
    if (dragRaf.current) cancelAnimationFrame(dragRaf.current);
    dragRaf.current = requestAnimationFrame(() => {
      const seconds = clientXToSeconds(e.clientX, el);
      onSeek?.(seconds);
    });
  }

  function handlePointerUp() {
    setDragging(false);
  }

  useEffect(() => {
    return () => {
      if (dragRaf.current) cancelAnimationFrame(dragRaf.current);
    };
  }, []);

  return (
    <div className="w-full">
      <div
        ref={rangeRef}
        className="relative h-[6px] rounded-full overflow-hidden cursor-pointer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ background: "rgba(6,182,212,0.12)" }}
        aria-label="Seek bar"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={safeDuration}
        aria-valuenow={Math.floor(safeCurrent)}
      >
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyan-400 to-blue-500"
          style={{ width: `${percent}%`, opacity: disabled ? 0.5 : 1 }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-[14px] h-[14px] rounded-full bg-[#e7faff] border border-white/20 shadow-[0_0_10px_var(--accent-glow)]"
          style={{ left: `calc(${percent}% - 7px)`, opacity: disabled ? 0.4 : 1 }}
        />
      </div>
    </div>
  );
}

