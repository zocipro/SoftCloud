export function utf8Base64(text) { return btoa(Array.from(new TextEncoder().encode(text),b=>String.fromCharCode(b)).join('')); }
export function fromBase64(text) { return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(text.trim()),c=>c.charCodeAt(0))); }
export function safeLinks(text) { return [...new Set((text.match(/https?:\/\/[^\s<>"'`，。；！？”）】]+/gi)||[]).map(s=>s.replace(/[，。；！）】]+$/u,'')))].filter(s=>{try{return ['http:','https:'].includes(new URL(s).protocol)}catch{return false}}); }
export function imageSize(width,height,max) { const r=Math.min(1,max/Math.max(width,height));return [Math.max(1,Math.round(width*r)),Math.max(1,Math.round(height*r))]; }
export function nicknames(name,count=10,blank=false) {const codes=['\u200b','\u200c','\u200d','\u2060'];return Array.from({length:count},(_,i)=>{const suffix=codes[i%4]+codes[Math.floor(i/4)%4]+codes[Math.floor(i/16)%4];return blank?suffix:name+suffix});}
