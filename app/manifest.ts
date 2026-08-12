import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bug Tracker",
    short_name: "Bug Tracker",
    description: "Bug tracker for managing projects and tasks",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4573D9",
    icons: [
      { src: "/api/pwa-icon?size=192", sizes: "192x192", type: "image/png" },
      { src: "/api/pwa-icon?size=512", sizes: "512x512", type: "image/png" },
      { src: "/api/pwa-icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}