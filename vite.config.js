import { defineConfig } from "vite";

// Plugin to detect .env file changes and trigger rebuild
const envWatchPlugin = {
  name: "env-file-watch",
  handleHotUpdate({ file, server }) {
    // If .env file changes, restart the dev server to reload environment variables
    if (file.endsWith(".env") || file.endsWith(".env.local") || file.endsWith(".env.example")) {
      console.log(`\n🔄 ${file} changed - restarting dev server to reload environment variables\n`);
      server.restart();
      return [];
    }
  }
};

// MV3 extensions need stable filenames (no hashing) because they're referenced by manifest.json.
export default defineConfig({
  plugins: [envWatchPlugin],
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
  publicDir: "public",
  server: {
    watch: {
      // Watch source files, public assets, and .env files for changes
      include: ["src/**/*", "public/**/*", ".env", ".env.local", ".env.example"],
      // Don't watch node_modules to avoid performance issues
      exclude: ["node_modules/**", "dist/**"]
    }
  }
});
