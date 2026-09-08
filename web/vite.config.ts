import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  build: {
    rollupOptions: {
      /**
       * Two separate applications from one project.
       *
       * The staff console is its own bundle so that customers never download
       * staff code, and the public site never ships a staff sign-in.
       */
      input: {
        admin: resolve(__dirname, 'admin.html'),
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173
  }
});
