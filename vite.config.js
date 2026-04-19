import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: { open: true },
  build: { target: 'es2022' },
});
