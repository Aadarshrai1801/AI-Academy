import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Academy",
    short_name: "AI Academy",
    start_url: "/",
    display: "standalone",
    background_color: "#F8F9FA",
    theme_color: "#F8F9FA",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
