/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "bg-base": "var(--bg-base)",
        "bg-surface": "var(--bg-surface)",
        "bg-elevated": "var(--bg-elevated)",
        "bg-overlay": "var(--bg-overlay)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        "border-subtle": "var(--border-subtle)",
        "border-active": "var(--border-active)",
        "accent-cyan-400": "var(--cyan-400)",
        "accent-cyan-500": "var(--cyan-500)",
        "accent-blue-500": "var(--blue-500)",
        "success": "var(--success)",
        "warning": "var(--warning)",
        "danger": "var(--danger)"
      },
      boxShadow: {
        "accent-glow": "0 0 24px var(--accent-glow)"
      },
      transitionTimingFunction: {
        "ease-out-200": "cubic-bezier(0.4, 0, 0.2, 1)"
      }
    }
  },
  plugins: []
};

