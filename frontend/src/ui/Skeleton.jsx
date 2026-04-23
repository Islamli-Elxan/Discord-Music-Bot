import React from "react";

export default function Skeleton({ className = "" }) {
  return (
    <div
      className={[
        "animate-pulse",
        "bg-[rgba(6,182,212,0.12)]",
        "border border-[var(--border-subtle)]",
        className
      ].join(" ")}
      aria-hidden="true"
    />
  );
}

