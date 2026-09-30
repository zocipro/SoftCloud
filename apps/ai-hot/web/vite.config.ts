import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({base:'/tools/ai-hot/',plugins:[tailwindcss()],define:{'process.env':'{}'},server:{proxy:{'/assets':{target:'http://127.0.0.1:8790'},'/api/ai-hot':{target:'http://127.0.0.1:8790',changeOrigin:true}}},build:{outDir:'../../../tools/ai-hot',emptyOutDir:false,rolldownOptions:{onwarn(warning,defaultHandler){if(warning.code!=='MODULE_LEVEL_DIRECTIVE')defaultHandler(warning)}}},esbuild:{jsx:'automatic'}});
