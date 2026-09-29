import {build} from 'esbuild';
await build({entryPoints:['src/index.ts'],outfile:'dist-test/worker.mjs',bundle:true,platform:'node',format:'esm',loader:{'.md':'text'},external:['node:crypto']});
