import {defineConfig} from 'vite';
export default defineConfig({
 base:process.env.VITE_BASE_PATH||'/',
 server:{proxy:{'/api':{target:process.env.FINAGENTIC_API_URL||'http://127.0.0.1:3001',changeOrigin:false}}}
});
