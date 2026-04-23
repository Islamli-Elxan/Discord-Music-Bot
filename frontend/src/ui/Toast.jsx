import React from "react";
import { X } from "lucide-react";
import { useToasts } from "../context/ToastContext.jsx";

function typeStyles(type) {
  if (type === "success") return "border-success/30";
  if (type === "warning") return "border-warning/30";
  if (type === "danger" || type === "error") return "border-danger/30";
  return "border-cyan-400/30";
}

export default function ToastHost() {
  const { toasts, removeToast } = useToasts();
  return (
    <div className="fixed bottom-5 right-5 z-[999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            "pointer-events-auto max-w-[340px] w-[340px] rounded-2xl border bg-bg-elevated backdrop-blur-md shadow-[0_0_24px_rgba(6,182,212,0.12)] overflow-hidden",
            typeStyles(t.type)
          ].join(" ")}
        >
          <div className="p-3 flex items-start gap-3">
            <div className="h-2 w-2 rounded-full mt-2 bg-cyan-400" />
            <div className="min-w-0 flex-1">
              {t.title ? <div className="font-display font-bold text-sm">{t.title}</div> : null}
              {t.message ? <div className="text-xs text-text-secondary mt-1">{t.message}</div> : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss toast"
              onClick={() => removeToast(t.id)}
              className="text-text-muted hover:text-text-primary transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

