import React from "react";

export default function Card({ className = "", hover = true, children, ...props }) {
  return (
    <div
      {...props}
      className={[
        "card",
        hover ? "card-hover" : "",
        className
      ].join(" ")}
    >
      {children}
    </div>
  );
}

