import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import electron from 'vite-plugin-electron/simple';

const projectDir = path.dirname(fileURLToPath(import.meta.url));

/** Electron main/preload — flat CJS output (package.json "main" field) */
const electronOutDir = 'dist-electron';

/** Native / Node-only deps — never bundle into Main (serialport uses __dirname in bindings) */
const electronExternal = [
  'electron',
  'serialport',
  /^@serialport\//,
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

const electronRollupOutput = {
  format: 'cjs' as const,
  inlineDynamicImports: true,
};

function electronMainVite() {
  return {
    build: {
      outDir: electronOutDir,
      /** Merged with plugin lib.entry — force CJS despite package.json "type":"module" */
      lib: { formats: ['cjs'] } as import('vite').LibraryOptions,
      rollupOptions: {
        external: electronExternal,
        output: {
          ...electronRollupOutput,
          entryFileNames: 'main.cjs',
        },
      },
    },
  };
}

function electronPreloadVite() {
  return {
    build: {
      outDir: electronOutDir,
      rollupOptions: {
        external: electronExternal,
        output: {
          ...electronRollupOutput,
          entryFileNames: 'preload.cjs',
        },
      },
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: electronMainVite(),
      },
      preload: {
        input: 'electron/preload.ts',
        vite: electronPreloadVite(),
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(projectDir, 'src'),
      '@shared': path.resolve(projectDir, 'shared'),
    },
  },
  server: { port: 5173 },
});
