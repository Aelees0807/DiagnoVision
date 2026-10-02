import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const excludeLargeWasm = () => {
  return {
    name: 'exclude-large-wasm',
    generateBundle(options, bundle) {
      for (const fileName in bundle) {
        if (fileName.includes('ort-wasm')) {
          delete bundle[fileName];
        }
      }
    }
  };
};

export default defineConfig({
  plugins: [react(), excludeLargeWasm()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // ONNX Runtime Web uses WASM — exclude from Vite's dep optimization
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  server: {
    port: 5173,
    open: true,
    headers: {
      // Required for SharedArrayBuffer (ONNX Runtime multi-threading)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      // Forward /api requests to the FastAPI backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});

