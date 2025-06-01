import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'utils': resolve(__dirname, 'utils'),
      'components': resolve(__dirname, 'components'),
      'pages': resolve(__dirname, 'pages'),
    }
  },
  base: '/',  // 如果部署在子路径（如/blog），需改为'/blog/'
  server: {
    port: 3001,
    host: '0.0.0.0', // 关键修改：允许外部访问
    open: false,
    allowedHosts: [
      'starrystonetech.com.cn',    // 允许主域名
      'www.starrystonetech.com.cn' // 允许 www 子域名
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      }
    },
    watch: {
      // 只监听 src 目录，减少不必要的文件扫描
      ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
      usePolling: false, // 关闭轮询（减少 IO）
    },
  },
  // 定义环境变量
  define: {
    'process.env.AIPA_API_DOMAIN': JSON.stringify('') // 当使用代理时为空字符串
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
});
