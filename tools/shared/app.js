import {$,notice} from './common.js';
const mode=document.body.dataset.tool;let theme='light';try{theme=localStorage.getItem('softcloud-theme-blue')||'light'}catch{}function apply(){document.documentElement.dataset.theme=theme;$('#theme').textContent=theme==='dark'?'浅色模式':'深色模式'}apply();$('#theme').onclick=()=>{theme=theme==='dark'?'light':'dark';apply();try{localStorage.setItem('softcloud-theme-blue',theme)}catch{}};
const modules={codec:'./codec.js',poster:'./poster.js',batch:'./batch.js',names:'./names.js',parser:'./parser.js',life:'./life.js',guide:'./guide.js',prompts:'./prompts.js'};
try{const mod=await import(modules[mode]);await mod.init()}catch(e){notice('工具加载失败：'+e.message+'。请刷新重试。',true)}
