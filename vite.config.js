import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    },
    // 静的アセットをコピー
    copyPublicDir: true
  },
  // 開発時も本番時も/locales/でアクセスできるようにする
  publicDir: 'public'
});
