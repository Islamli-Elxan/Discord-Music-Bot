import React from "react";
import { motion } from "framer-motion";

export default function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--border-active)]";

  const variants = {
    primary:
      "bg-[var(--gradient-primary)] text-white shadow-[0_0_20px_var(--accent-glow)]",
    secondary: "bg-bg-elevated border border-border-subtle text-text-primary hover:border-border-active hover:shadow-[0_0_24px_var(--accent-glow)]",
    danger: "bg-danger/10 border border-danger/30 text-danger hover:border-danger hover:shadow-[0_0_24px_rgba(239,68,68,0.25)]"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className={`${base} ${variants[variant] || variants.secondary} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

