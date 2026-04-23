import React, { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";

import { PlayerProvider } from "./context/PlayerContext.jsx";
import { ToastProvider, useToasts } from "./context/ToastContext.jsx";

import Layout from "./components/layout/Layout.jsx";
import ToastHost from "./ui/Toast.jsx";

const NowPlaying = React.lazy(() => import("./pages/NowPlaying.jsx"));
const Queue = React.lazy(() => import("./pages/Queue.jsx"));
const Search = React.lazy(() => import("./pages/Search.jsx"));
const History = React.lazy(() => import("./pages/History.jsx"));
const Analytics = React.lazy(() => import("./pages/Analytics.jsx"));
const Settings = React.lazy(() => import("./pages/Settings.jsx"));

function ErrorFallback({ error }) {
  const { pushToast } = useToasts();
  // Report once per error
  React.useEffect(() => {
    pushToast({ type: "error", title: "UI error", message: error?.message || "Unknown error" });
  }, [error, pushToast]);

  return (
    <div className="p-6 text-text-primary">
      <div className="font-display text-xl mb-2">Something went wrong</div>
      <div className="text-text-secondary text-sm">{error?.message}</div>
    </div>
  );
}

export default function App() {
  const initialGuildId = "";
  return (
    <ToastProvider>
      <PlayerProvider initialGuildId={initialGuildId}>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Layout>
            <Suspense fallback={<div className="p-6 text-text-secondary">Loading...</div>}>
              <Routes>
                <Route path="/" element={<NowPlaying />} />
                <Route path="/queue" element={<Queue />} />
                <Route path="/search" element={<Search />} />
                <Route path="/history" element={<History />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
            <ToastHost />
          </Layout>
        </ErrorBoundary>
      </PlayerProvider>
    </ToastProvider>
  );
}

