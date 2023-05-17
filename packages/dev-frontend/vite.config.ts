/// <reference types="vitest" />

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import RollupPluginPolyfillNode from "rollup-plugin-polyfill-node";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "@liquity/providers",
      "@liquity/lib-ethers",
      "@liquity/lib-base",
      "@liquity/lib-react"
    ],
    esbuildOptions: {
      plugins: [NodeModulesPolyfillPlugin()]
    }
  },
  build: {
    commonjsOptions: {
      include: ["**.cjs", "**.js"]
    },
    rollupOptions: {
      plugins: [RollupPluginPolyfillNode()]
    }
  },
  resolve: {
    alias: {
      assert: "rollup-plugin-node-polyfills/polyfills/assert",
      events: "rollup-plugin-node-polyfills/polyfills/events"
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts"
  }
});
