import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs';

function copyFiles() {
  return {
    name: 'copy-files',
    writeBundle() {
      const dist = resolve(__dirname, 'dist');
      if (!existsSync(dist)) mkdirSync(dist, { recursive: true });
      copyFileSync(resolve(__dirname, 'public/manifest.json'), resolve(dist, 'manifest.json'));
      const id = resolve(dist, 'icons');
      if (!existsSync(id)) mkdirSync(id, { recursive: true });
      const si = resolve(__dirname, 'public/icons');
      if (existsSync(si)) { for (const f of readdirSync(si)) copyFileSync(resolve(si, f), resolve(id, f)); }
      const cc = resolve(__dirname, 'src/content/styles.css');
      if (existsSync(cc)) copyFileSync(cc, resolve(dist, 'content.css'));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), copyFiles()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        content: resolve(__dirname, 'src/content/index.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (c) => { if (c.name === 'content') return 'content.js'; if (c.name === 'background') return 'background.js'; return 'assets/[name]-[hash].js'; },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
});
