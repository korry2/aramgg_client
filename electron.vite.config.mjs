import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    envPrefix: ['VITE_', 'ARAMGG_'],
    build: {
      target: 'node24',
      sourcemap: false,
      lib: {
        entry: 'src/main/main.ts',
        formats: ['es']
      },
      rollupOptions: {
        output: {
          entryFileNames: 'main.js'
        },
        external: ['electron', 'electron-store', 'axios', 'fs', 'path', 'https']
      },
      outDir: 'dist-electron',
      emptyOutDir: true
    },
    resolve: {
      // 添加 TypeScript 支持
      extensions: ['.ts', '.js', '.mjs', '.json']
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      target: 'node24',
      sourcemap: false,
      lib: {
        entry: 'src/preload/preload.ts',
        formats: ['cjs']
      },
      rollupOptions: {
        output: {
          entryFileNames: 'preload.cjs'
        }
      },
      outDir: 'dist-electron',
      emptyOutDir: false
    }
  },
  renderer: {
    root: 'src/renderer',
    publicDir: path.resolve(import.meta.dirname || process.cwd(), 'public'),
    build: {
      outDir: path.resolve(import.meta.dirname || process.cwd(), 'dist'),
      sourcemap: false,
      rollupOptions: {
        input: {
          index: path.resolve(import.meta.dirname || process.cwd(), 'src/renderer/index.html')
        }
      },
      commonjsOptions: {
        transformMixedEsModules: true
      }
    },
    server: {
      port: 5173,
      strictPort: false,
      headers: {
        'Content-Security-Policy': "frame-ancestors 'none'"
      },
      fs: {
        strict: false
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || process.cwd(), 'src/renderer'),
        'src': path.resolve(import.meta.dirname || process.cwd(), 'src/renderer')
      },
      // 添加 TypeScript 支持
      extensions: ['.ts', '.js', '.mjs', '.vue', '.json']
    },
    plugins: [vue(), tailwindcss()]
  }
})
