import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZHA Better",
    short_name: "ZHA",
    description: "A better YouTube Music client",
    start_url: "/",
    display: "standalone",
    background_color: "#070b14",
    theme_color: "#070b14",
    icons: [
      {
        src: "/logo.jpeg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/logo.jpeg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "maskable",
      },
    ],
  };
}
