// Shared app-icon graphic, rendered via next/og's ImageResponse (Satori) — used by
// app/icon.tsx, app/apple-icon.tsx, and the PWA manifest icon route. Kept in one place
// so the tab icon, iOS home-screen icon, and installable-PWA icon all match.
//
// Design: the app's brand blue (#4573D9, used throughout the UI for buttons/links) as a
// rounded-square tile with a white checkmark — the app's own primary iconography for
// "task" already leans on checkmarks (CheckCircle2 everywhere a task can be completed),
// so this keeps the icon visually consistent with the product rather than introducing a
// new symbol (e.g. a literal bug glyph) nowhere else in the UI.
export const BRAND_BLUE = "#4573D9";

export function AppIconMark({ size, maskable = false }: { size: number; maskable?: boolean }) {
  // Maskable icons (used by Android/Chrome for adaptive home-screen icons) get clipped
  // to an arbitrary shape by the OS, so content must stay inside a centered "safe zone"
  // (~80% of the icon) and the background must be full-bleed with no rounded corners —
  // the OS supplies its own shape.
  const glyphSize = maskable ? size * 0.42 : size * 0.52;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_BLUE,
        borderRadius: maskable ? 0 : size * 0.22,
      }}
    >
      <svg
        width={glyphSize}
        height={glyphSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth={2.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
  );
}
