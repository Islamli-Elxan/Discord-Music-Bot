import React from "react";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-glow">
      <div className="flex">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <div className="flex-1 min-w-0">
          <Topbar />
          <div className="p-4 md:p-6">{children}</div>
        </div>
      </div>

      <div className="md:hidden">
        <Sidebar mobileBottom />
      </div>
    </div>
  );
}

