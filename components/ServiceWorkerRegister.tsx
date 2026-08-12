"use client";

import { useEffect } from "react";

// Registers the PWA service worker. Skipped in dev — a cached /_next/static/ response
// would fight Next''s dev server/HMR and cause stale-bundle confusion while iterating.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  return null;
}