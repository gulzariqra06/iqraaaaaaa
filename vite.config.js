import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/gemini-api': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/gemini-api/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('Origin', 'https://generativelanguage.googleapis.com');
          });
        }
      },
      '/airforce-api': {
        target: 'https://api.airforce',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/airforce-api/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('Origin', 'https://api.airforce');
          });
        }
      },
      '/pollination-api': {
        target: 'https://text.pollinations.ai',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/pollination-api/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('Origin', 'https://text.pollinations.ai');
          });
        }
      }
    }
  }
});
