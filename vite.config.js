import { defineConfig } from 'vite';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ロケールファイルを自動コピーするプラグイン
function copyLocalesPlugin() {
  let isDevMode = false;
  
  return {
    name: 'copy-locales',
    configResolved(resolvedConfig) {
      isDevMode = resolvedConfig.command === 'serve';
    },
    buildStart() {
      copyLocales();
    },
    handleHotUpdate({ file }) {
      // 開発モードで src/i18n/locales/ のファイルが変更された時に自動コピー
      if (isDevMode && file.includes('src/i18n/locales/')) {
        console.log('🔄 ロケールファイルの変更を検出、コピー中...');
        copyLocales();
      }
    }
  };
}

function copyLocales() {
  const srcDir = join(__dirname, 'src', 'i18n', 'locales');
  const destDir = join(__dirname, 'public', 'locales');
  
  // 出力先ディレクトリが存在しない場合は作成
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  
  // src/i18n/locales/ のすべての .json ファイルをコピー
  if (existsSync(srcDir)) {
    const files = readdirSync(srcDir);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const srcPath = join(srcDir, file);
        const destPath = join(destDir, file);
        
        try {
          copyFileSync(srcPath, destPath);
          console.log(`✅ ${file} をコピーしました`);
        } catch (error) {
          console.error(`❌ ${file} のコピーに失敗:`, error.message);
        }
      }
    });
  }
}

export default defineConfig({
  plugins: [
    copyLocalesPlugin()
  ],
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
