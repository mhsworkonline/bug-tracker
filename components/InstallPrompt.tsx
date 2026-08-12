"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISSED_KEY = "bt-install-hint-dismissed";

// Android/Chrome show their own native "Install app" prompt automatically once the
// manifest + service worker are registered — no custom UI needed there. iOS Safari has
// no such prompt at all, so this is the one platform that needs a manual nudge (per
// Next.js's own PWA guide pattern).
export default function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    const dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    setShow(isIOS && !isStandalone && !dismissed);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[200] bg-[#151B26] text-white text-sm px-4 py-3 flex items-center gap-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <span className="flex-1">
        Install this app: tap <Share size={14} className="inline -mt-0.5" /> then &quot;Add to Home Screen&quot;.
      </span>
      <button
        onClick={() => { localStorage.setItem(DISMISSED_KEY, "1"); setShow(false); }}
        className="p-1 hover:bg-white/10 rounded flex-shrink-0"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}