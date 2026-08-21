// Keeps every image/video attachment opened from a task's detail panel
// grouped into one browser window, as new tabs within it — using real,
// full Chrome tabs (no stripped-down popup chrome).
//
// The attachments themselves are hosted on a different origin (Supabase
// Storage / Cloudinary / R2), and the browser blocks scripts from
// controlling a tab once it has navigated to another origin. So instead of
// pointing tabs straight at the attachment URL, each tab is pointed at our
// own same-origin /media viewer, which displays the attachment. Because the
// tab never leaves our origin, we keep the ability to open more tabs into
// that same window for every attachment clicked afterward.
//
// First attachment opened: browser decides where the tab lands (normally a
// new tab in the current window). Every attachment opened after that, while
// that tab/window is still open, is added as a new tab next to it. If that
// window gets closed (or the Bug Tracker tab is reloaded/reopened, which
// clears this in-memory handle), the next click just opens a new tab again.
let mediaWindowHandle: Window | null = null;

export function openMediaAttachment(url: string, name: string, fileType: string) {
  if (typeof window === "undefined") return;

  const viewerUrl = `/media?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}&type=${encodeURIComponent(fileType)}`;

  if (mediaWindowHandle && !mediaWindowHandle.closed) {
    try {
      mediaWindowHandle.open(viewerUrl, "_blank");
      return;
    } catch {
      // Handle is no longer usable for some reason — fall through and open a fresh tab.
    }
  }

  mediaWindowHandle = window.open(viewerUrl, "_blank");
}
