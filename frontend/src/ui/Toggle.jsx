import React from "react";

export default function Toggle({ checked, onChange, ariaLabel = "Toggle" }) {
  return (
    <label className="inline-flex items-center cursor-pointer select-none" aria-label={ariaLabel}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange?.(e.target.checked)} />
      <span
        className={[
          "relative inline-flex items-center h-7 w-12 rounded-full transition-all duration-200 border border-border-subtle",
          checked ? "bg-[var(--gradient-primary)]" : "bg-bg-elevated"
        ].join(" ")}
      >
        <span
          className={[
            "h-6 w-6 rounded-full bg-[#e7faff] transition-transform duration-200 shadow-[0_0_12px_var(--accent-glow)]",
            checked ? "translate-x-5" : "translate-x-1"
          ].join(" ")}
        />
      </span>
    </label>
  );
}

