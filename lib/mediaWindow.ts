// Keeps every image/video attachment opened from a task's detail panel
// grouped into one separate browser window, as new tabs within it.
//
// How it works: the first attachment opened spawns a new browser window and
// we keep an in-memory handle to it. Every attachment opened after that is
// sent through that same handle, which makes the browser add it as a new
// tab in that same window instead of a new window. If that window gets
// closed (or the Bug Tracker tab is reloaded/reopened, which clears this
// memory), the next attachment click starts a fresh window again.
let mediaWindowHandle: Window | null = null;

export function openMediaAttachment(url: string) {
  if (typeof window === "undefined") return;

  if (mediaWindowHandle && !mediaWindowHandle.closed) {
    mediaWindowHandle.open(url, "_blank");
    return;
  }

  mediaWindowHandle = window.open(url, "_blank", "width=1280,height=900");
}
