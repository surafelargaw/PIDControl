import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app";
import { HashRouteProvider } from "@/lib/platform/hash-router";
import "../app/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("PID Trainer root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <HashRouteProvider>
      <App />
    </HashRouteProvider>
  </StrictMode>
);
