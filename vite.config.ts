import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

function photoPlaceholderGuard() {
  return {
    name: "photo-placeholder-guard",
    buildStart() {
      const isProd = process.env.NODE_ENV === "production";
      // Only enforce in production builds (vite build)
      if (!isProd) return;
      // Scan source files for placeholder being used as the primary load target.
      // The check is intentionally narrow: if PHOTO_PLACEHOLDER_SRC is still the
      // value of PHOTO_LOAD_SRC in textures.ts, the build must fail loudly.
      const texturesPath = path.join(__dirname, "src/scene/textures.ts");
      try {
        const content = fs.readFileSync(texturesPath, "utf8");
        // Look for the primary loader assignment — this is the signal that the
        // real BW portrait has not yet replaced the placeholder.
        if (content.includes("PHOTO_LOAD_SRC = PHOTO_PLACEHOLDER_SRC")) {
          const msg = [
            "[photo-placeholder-guard] Production build blocked:",
            "  src/scene/textures.ts still points PHOTO_LOAD_SRC at PHOTO_PLACEHOLDER_SRC",
            "  (/img/about-placeholder-NOT-FINAL.jpg). No real portrait exists yet —",
            "  see the photoshoot brief. Replace the primary load target with",
            "  PHOTO_FINAL_SRC (/img/about-portrait.png) once the pre-processed",
            "  black-and-white PNG with real tonal range is delivered (used as PNG, never converted to JPG).",
            "  To keep iterating locally, run `vite dev`; this guard only runs on `vite build`.",
          ].join("\n");
          // Throwing here fails the build loudly, as required.
          throw new Error(msg);
        }
        // Also fail if any source file still imports or renders the tag-line zone
        const fallbackPath = path.join(__dirname, "src/components/FallbackAbout.tsx");
        const fallbackContent = fs.readFileSync(fallbackPath, "utf8");
        if (fallbackContent.includes("AI AGENTS") || fallbackContent.includes('zone="T"') || fallbackContent.includes("aboutZones.T")) {
          throw new Error("[photo-placeholder-guard] FallbackAbout still references the cut tag line (T zone). Remove all T references per spec §5.");
        }
        const appPath = path.join(__dirname, "src/App.tsx");
        const appContent = fs.readFileSync(appPath, "utf8");
        if (appContent.includes('data-zone="T"')) {
          throw new Error("[photo-placeholder-guard] App.tsx zone layer still references cut T tag line. Only E, H and BC should render.");
        }
      } catch (e) {
        if ((e as Error).message.startsWith("[photo-placeholder-guard]")) throw e;
        // If files missing, don't block — let vite's own errors surface
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), photoPlaceholderGuard()],
});
