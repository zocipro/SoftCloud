import {one} from './publication.ts';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function readLimited(request:Request,limit:number){const reader=request.body?.getReader();if(!reader)return new Uint8Array();const parts:Uint8Array[]=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('too_large');parts.push(value);}}finally{await reader.cancel();}const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return bytes;}
export async function feedbackApi(request:Request,env:Env):Promise<Response> {
  if(request.method!=='POST')return json({detail:'仅支持提交反馈'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({detail:'请从本站反馈页提交'},403);
  let form:FormData;try{const body=await readLimited(request,350000);form=await new Response(body,{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData();}catch{return json({detail:'内容过大或格式错误，截图请小于 256 KB'},413);}
  const content=String(form.get('content')||'').trim(),email=String(form.get('email')||'').slice(0,254),page=String(form.get('pageUrl')||'').slice(0,2000);
  if(content.length<2||content.length>6000)return json({detail:'反馈内容须为 2 到 6000 个字符'},400);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({detail:'邮箱格式不正确'},400);
  let screenshot:string|null=null;const shot=form.get('screenshot');
  if(shot instanceof File&&shot.size){if(shot.size>262144||!['image/png','image/jpeg','image/webp'].includes(shot.type))return json({detail:'截图只支持 PNG、JPEG 或 WebP，且须小于 256 KB'},400);screenshot=`data:${shot.type};base64,${Buffer.from(await shot.arrayBuffer()).toString('base64')}`;}
  const sourceHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('softcloud-feedback:'+request.headers.get('CF-Connecting-IP')))),b=>b.toString(16).padStart(2,'0')).join('');
  if(await one(env.DB,'SELECT source_hash FROM feedback_bans WHERE source_hash=?',sourceHash))return json({detail:'此来源暂时无法提交反馈'},429);
  const now=Date.now(),hour=await one<{n:number}>(env.DB,'SELECT count(*) n FROM feedback WHERE source_hash=? AND created>?',sourceHash,now-3600000);
  if((hour?.n??0)>=5)return json({detail:'每小时最多提交 5 条反馈，请稍后再试'},429);
  const id=crypto.randomUUID();const r=await env.DB.prepare("INSERT INTO feedback(id,kind,message,email,page_url,screenshot,source_hash,created,updated) SELECT ?,'reader',?,?,?,?,?,?,? WHERE (SELECT count(*) FROM feedback WHERE created>?)<100").bind(id,content,email||null,page||null,screenshot,sourceHash,now,now,now-86400000).run();
  if(!r.meta.changes)return json({detail:'今天的反馈受理量已达上限，请明天再试'},429);
  return json({id});
}
