import { defineConfig } from "vite";

// MV3 extensions need stable filenames (no hashing) because they’re referenced by manifest.json.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        "background/background": "src/background/background.js",
        "content/content": "src/content/content.js"
      },
      output: {
        // Keeps output paths stable: dist/background/background.js, dist/content/content.js, etc.
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  },
  // Keep the extension manifest as a static asset copied to dist/.
  publicDir: "public"
});
