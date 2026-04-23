import React from "react";

export default function Slider({ value, min = 0, max = 100, onChange, ariaLabel = "Slider" }) {
  return (
    <div className="w-full">
      <input
        aria-label={ariaLabel}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
      />
    </div>
  );
}

