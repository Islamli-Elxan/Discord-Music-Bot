import React, { createContext, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const api = useMemo(() => {
    function pushToast({ type = "info", title = "", message = "", ttlMs = 4000 }) {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const toast = { id, type, title, message, ttlMs, createdAt: Date.now() };
      setToasts((prev) => [toast, ...prev].slice(0, 5));

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, ttlMs);
    }

    function removeToast(id) {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }

    return { pushToast, removeToast, toasts };
  }, [toasts]);

  return <ToastContext.Provider value={api}>{children}</ToastContext.Provider>;
}

export function useToasts() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToasts must be used within ToastProvider");
  return ctx;
}

