import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // specific allowed hosts or true to allow all
    allowedHosts: true,
    // Listen on all addresses
    host: true
  }
});