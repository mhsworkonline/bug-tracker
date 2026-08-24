"use client";

import { useEffect, useRef } from "react";

interface Props {
  onClose: () => void;
  children: React.ReactNode;
  /** Desktop dialog width (e.g. "max-w-lg"). Mobile is always full-width. */
  maxWidth?: string;
  /** Match the z-index the call site used before migrating, so stacking with sibling overlays doesn't shift. */
  zIndex?: number;
  className?: string;
}

// Shared modal shell: a bottom sheet on mobile (slides up, rounded top corners, drag
// handle) and a centered dialog on desktop — one primitive so every modal opens the same
// way instead of each rolling its own centered-box overlay, which is what made the app
// feel like a resized website rather than a native app on phones.
//
// Children own their own header/body/footer markup; give the body region `flex-1
// overflow-y-auto` if it can grow past the viewport (the outer shell caps height and
// clips overflow, matching how a native sheet only scrolls its content).
export default function Sheet({ onClose, children, maxWidth = "max-w-lg", zIndex = 50, className = "" }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center"
      style={{ zIndex }}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={`bg-white w-full ${maxWidth} rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] sm:max-h-[85vh] max-sm:animate-[bt-sheet-up_.25s_ease-out] sm:animate-[bt-fade-in_.15s_ease-out] ${className}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-[#E8E8E9]" />
        </div>
        {children}
      </div>
    </div>
  );
}
