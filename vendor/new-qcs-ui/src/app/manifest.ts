import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QuantumCrafters Studio",
    short_name: "QCS Studio",
    description:
      "AI growth, automation, web/app engineering, and LinkedIn profile audit services from QuantumCrafters.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b1120",
    theme_color: "#0b1120",
    orientation: "portrait",
    categories: ["business", "productivity", "marketing"],
    icons: [
      {
        src: "/assets/img/Images/favicon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/assets/img/Images/favicon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
