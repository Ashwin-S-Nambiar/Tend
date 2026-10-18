import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const notFoundPage = (): Plugin => {
  let outDir = '';
  return {
    name: 'not-found-page',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await copyFile(
        resolve(outDir, 'index.html'),
        resolve(outDir, '404.html'),
      );
    },
  };
};

export default defineConfig({
  plugins: [react(), tailwindcss(), notFoundPage()],
});
