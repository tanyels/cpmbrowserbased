import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Optimize for production
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          excel: ['exceljs']
        }
      }
    }
  },
  server: {
    port: 3000,
    strictPort: true
  },
  // Define environment for browser
  define: {
    'process.env': {}
  },
  // Resolve Node.js modules for browser
  resolve: {
    alias: {
      // Polyfills for Node.js modules used by exceljs
      stream: 'stream-browserify',
      buffer: 'buffer'
    }
  },
  optimizeDeps: {
    include: ['buffer', 'exceljs']
  }
});
