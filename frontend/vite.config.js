import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh for React components
      jsxRuntime: "automatic",
      // Include all JSX files
      include: /\.(jsx|tsx|js|ts|mdx)$/,
      babel: {
        // Enable parsing of class properties and decorators
        parserOpts: {
          plugins: ["decorators-legacy", "classProperties"],
        },
        // Use project's Babel configuration if exists
        babelrc: true,
        configFile: true,
      },
    }),
  ],
  server: {
    // Configure server for development
    port: 5173,
    strictPort: true,
    host: true,
  },
  preview: {
    // Configure preview server
    port: 5173,
    strictPort: true,
    host: true,
  },
  build: {
    // Ensure proper handling of client-side routing
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // Handle client-side routing in production
  base: "/",
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
