export const $=s=>document.querySelector(s);
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function notice(text,error=false){const n=$('#notice');n.textContent=text;n.classList.toggle('error',error);}
export function save(key,value){try{localStorage.setItem('sc-tools-'+key,JSON.stringify(value));return true}catch{notice('当前浏览器无法保存记录，请及时导出。',true);return false}}
export function load(key,fallback){try{return JSON.parse(localStorage.getItem('sc-tools-'+key))??fallback}catch{return fallback}}
export async function copy(text){try{await navigator.clipboard.writeText(text);notice('已复制')}catch{notice('复制未成功，请选中结果手动复制。',true)}}
export function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),15000);}
export const blobCanvas=(c,type='image/png',quality=.9)=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('图片导出失败')),type,quality));
export function imageFile(file){return new Promise((resolve,reject)=>{if(!file||!file.type.startsWith('image/'))return reject(Error('请选择图片文件'));if(file.size>25*1024*1024)return reject(Error('请使用 25 MB 以内的图片'));const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);if(im.width*im.height>40000000)return reject(Error('图片尺寸过大，请缩小后再试'));resolve(im)};im.onerror=()=>{URL.revokeObjectURL(u);reject(Error('无法读取此图片，请使用 PNG、JPG 或 WebP'))};im.src=u})}
export async function run(fn){try{await fn()}catch(e){notice(e.message||'操作失败，请检查输入。',true)}}
export function bind(id,fn){$(id).addEventListener('click',()=>run(fn))}
export const field=(label,id,value='',type='text')=>`<label class="field">${label}<input id="${id}" type="${type}" value="${esc(value)}"></label>`;
export const area=(label,id,value='',rows=8)=>`<label class="field">${label}<textarea id="${id}" rows="${rows}">${esc(value)}</textarea></label>`;
export const button=(id,text,secondary=false)=>`<button type="button" id="${id}" class="${secondary?'secondary':''}">${text}</button>`;
export const fileField=(id,multiple=false)=>`<label class="upload">选择${multiple?'多张':''}图片<input type="file" id="${id}" accept="image/png,image/jpeg,image/webp,image/gif" ${multiple?'multiple':''}></label>`;
export function cover(ctx,img,x,y,w,h){const r=Math.max(w/img.width,h/img.height);ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(img,x+(w-img.width*r)/2,y+(h-img.height*r)/2,img.width*r,img.height*r);ctx.restore()}
export function textFit(ctx,text,x,y,width,size=32,color='#18394c'){ctx.fillStyle=color;ctx.font=`600 ${size}px sans-serif`;while(ctx.measureText(text).width>width&&size>12){size--;ctx.font=`600 ${size}px sans-serif`}ctx.fillText(text,x,y,width)}
