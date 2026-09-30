import {contentChain,runView,bench} from './admin-data.ts';
import {readLimited} from './feedback.ts';
import {CATEGORY_KEYS} from '../contracts/src/taxonomy.ts';
import { timingSafeEqual } from 'node:crypto';
import { query,one,iso } from './publication.ts';
import { CAPABILITIES,MODELS,configuredModel,budgetConfig } from './models.ts';
import seed from '../upstream/sources.json';
import { safeUrl,utcDay } from './core.mjs';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const exec=(db:D1Database,sql:string,...args:unknown[])=>db.prepare(sql).bind(...args).run();
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const equal=async(a:string,b:string)=>timingSafeEqual(new TextEncoder().encode(await digest(a)),new TextEncoder().encode(await digest(b)));
const redirect=(location:string,headers:Record<string,string>={})=>new Response(null,{status:303,headers:{Location:location,'Cache-Control':'no-store',...headers}});
interface Session {csrf:string;expires:number}
type AdminEnv=Env&{ADMIN_PASSWORD?:string;ADMIN_TOKEN?:string};
function password(env:AdminEnv){return env.ADMIN_PASSWORD&&env.ADMIN_PASSWORD.length>=12?env.ADMIN_PASSWORD:env.ADMIN_TOKEN&&env.ADMIN_TOKEN.length>=24?env.ADMIN_TOKEN:null;}
export async function adminSession(request:Request,env:AdminEnv):Promise<Session|null> {
  const token=request.headers.get('cookie')?.match(/(?:^|;\s*)softcloud_hot_admin=([a-f0-9-]{36})/)?.[1];
  if(!token)return null;
  return one<Session>(env.DB,'SELECT csrf,expires FROM admin_sessions WHERE token_hash=? AND expires>?',await digest(token),Date.now());
}
async function payload(request:Request,max=65536):Promise<Record<string,unknown>> {
  const reader=request.body?.getReader();let bytes=0,raw='';const decoder=new TextDecoder();
  if(!reader)return {};
  try{while(true){const{done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>max)throw new Error('请求过大');raw+=decoder.decode(value,{stream:true});}}finally{await reader.cancel();}
  return JSON.parse(raw+decoder.decode());
}
interface SourceRow {id:string;name:string;url:string;tier:string;enabled:number;kind:string;config:string;first_party:number;participation_mode:string;interval_minutes:number;source_tags:string;owner_entity_id:string|null;last_checked:number;last_success:number|null;error:string|null;created:number;version:number;items_7d?:number;selected_30d?:number;}
function sourceView(s:SourceRow){return {...s,enabled:Boolean(s.enabled),first_party:Boolean(s.first_party),config:JSON.parse(s.config),tags:JSON.parse(s.source_tags),health:!s.enabled?'paused':s.error?'failing':s.last_success?'ok':'unknown',fail_count:s.error?1:0,last_ok_at:s.last_success?iso(s.last_success):null,last_fetch_at:s.last_checked?iso(s.last_checked):null,last_error:s.error,next_fetch_at:iso(s.last_checked+s.interval_minutes*60000),site_fulltext:false,syndicate_fulltext:false,signal_group_id:null,cursor:null,created_at:iso(s.created),updated_at:iso(s.version),items_7d:s.items_7d??0,selected_30d:s.selected_30d??0};}
const audit=(db:D1Database,action:string,subject:string,before:unknown,after:unknown,reason:unknown)=>exec(db,'INSERT INTO admin_audit(action,subject,before_value,after_value,reason,created) VALUES(?,?,?,?,?,?)',action,subject,JSON.stringify(before),JSON.stringify(after),typeof reason==='string'?reason.slice(0,500):null,Date.now());

export async function adminApi(request:Request,env:AdminEnv,path:string,preview?:(url:string)=>Promise<{ms:number;count:number;items:Array<{title:string;url:string|null;publishedAt:string;excerpt:string;body:string}>}>):Promise<Response|null> {
  const db=env.DB,url=new URL(request.url);
  if(path==='/auth/options')return json({password:Boolean(password(env)),feishu:false});
  if(path==='/auth/login')return redirect('/tools/ai-hot/admin/login');
  if(path==='/auth/password') {
    if(request.method!=='POST'||request.headers.get('origin')!==url.origin)return json({detail:'不允许的登录请求'},403);
    const secret=password(env);if(!secret)return redirect('/tools/ai-hot/admin/login?error=unset');
    const ipHash=await digest('admin:'+request.headers.get('CF-Connecting-IP'));
    const attempt=await one<{count:number;expires:number}>(db,'SELECT * FROM admin_attempts WHERE key=?',ipHash);
    if(attempt&&attempt.expires>Date.now()&&attempt.count>=8)return redirect('/tools/ai-hot/admin/login?error=too-many');
    if(Number(request.headers.get('Content-Length'))>4096)return json({detail:'请求过大'},413);
    let form:FormData;try{const bytes=await readLimited(request,4096);form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData();}catch{return json({detail:'登录内容过大或格式错误'},413);}const given=String(form.get('password')||'').slice(0,1024);
    await exec(db,'INSERT INTO admin_attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires>? THEN count+1 ELSE 1 END,expires=CASE WHEN expires>? THEN expires ELSE excluded.expires END',ipHash,Date.now()+900000,Date.now(),Date.now());
    if(!await equal(secret,given))return redirect('/tools/ai-hot/admin/login?error=wrong');
    const token=crypto.randomUUID(),csrf=crypto.randomUUID();
    await exec(db,'INSERT INTO admin_sessions(token_hash,csrf,expires) VALUES(?,?,?)',await digest(token),csrf,Date.now()+8*3600000);
    await exec(db,'DELETE FROM admin_attempts WHERE key=?',ipHash);
    const target=String(form.get('return')||'/admin');
    return redirect('/tools/ai-hot'+(/^\/admin(?:\/|\?|$)/.test(target)&&!target.includes('\\')?target:'/admin'),{'Set-Cookie':`softcloud_hot_admin=${token}; Path=/api/ai-hot; Secure; HttpOnly; SameSite=Strict; Max-Age=28800`});
  }
  if(!path.startsWith('/admin')&&path!=='/auth/logout')return null;
  const session=await adminSession(request,env);
  const bearer=request.headers.get('Authorization')?.replace(/^Bearer /,'');
  const tokenAuth=Boolean(env.ADMIN_TOKEN&&env.ADMIN_TOKEN.length>=24&&bearer&&await equal(env.ADMIN_TOKEN,bearer));
  if(!session&&!tokenAuth)return json({detail:'请登录管理后台'},401);
  const mutation=!['GET','HEAD'].includes(request.method);
  if(mutation&&!tokenAuth&&(request.headers.get('origin')!==url.origin||request.headers.get('x-csrf-token')!==session?.csrf)&&path!=='/auth/logout')return json({detail:'登录验证失效，请刷新后重试'},403);
  if(path==='/auth/logout'){
    if(request.method!=='POST'||request.headers.get('origin')!==url.origin)return json({detail:'请求无效'},403);
    const token=request.headers.get('cookie')?.match(/softcloud_hot_admin=([a-f0-9-]{36})/)?.[1];if(token)await exec(db,'DELETE FROM admin_sessions WHERE token_hash=?',await digest(token));
    return redirect('/tools/ai-hot/',{'Set-Cookie':'softcloud_hot_admin=; Path=/api/ai-hot; Secure; HttpOnly; SameSite=Strict; Max-Age=0'});
  }
  if(path==='/admin')return json({ok:true});
  if(path==='/admin/me')return json({name:'软云管理员',csrf:session?.csrf??'',dev:false});
  if(path==='/admin/nav-counts'){const failed=await one<{n:number}>(db,'SELECT count(*) n FROM sources WHERE error IS NOT NULL AND enabled=1');const feedback=await one<{n:number}>(db,"SELECT count(*) n FROM feedback WHERE status='new'");return json({sources:failed?.n??0,feedback:feedback?.n??0});}
  if(path==='/admin/sources'&& !mutation) {
    const q=url.searchParams.get('q')?.slice(0,200)||'';
    const rows=await query<SourceRow>(db,`SELECT s.*,(SELECT count(*) FROM items WHERE source_id=s.id AND discovered>strftime('%s','now')*1000-604800000) items_7d,(SELECT count(*) FROM items WHERE source_id=s.id AND selected=1 AND stage='done' AND visibility='public' AND published>strftime('%s','now')*1000-2592000000) selected_30d FROM sources s WHERE name LIKE ? OR id LIKE ? OR url LIKE ? ORDER BY error IS NULL,name`,'%'+q+'%','%'+q+'%','%'+q+'%');
    const views=rows.map(sourceView).filter(s=>(!url.searchParams.get('kind')||s.kind===url.searchParams.get('kind'))&&(!url.searchParams.get('health')||s.health===url.searchParams.get('health')));
    return json({page:1,rows:views,totals:{total:rows.length,enabled:rows.filter(r=>r.enabled).length,failing:rows.filter(r=>r.error&&r.enabled).length,degraded:0}});
  }
  const srcMatch=/^\/admin\/sources\/([a-zA-Z0-9_-]{1,80})(?:\/(.*))?$/.exec(path);
  if(srcMatch&&!mutation){const s=await one<SourceRow>(db,'SELECT * FROM sources WHERE id=?',srcMatch[1]);if(!s)return json({detail:'信源不存在'},404);
    const items=await query<Record<string,unknown>>(db,"SELECT id,title,url,datetime(discovered/1000,'unixepoch') discovered_at,datetime(published/1000,'unixepoch') published_at,stage processing_state,selected,visibility,title_zh FROM items WHERE source_id=? ORDER BY discovered DESC LIMIT 30",s.id);
    const stats=await one(db,"SELECT count(*) total,sum(discovered>?) last7d,sum(stage='done' AND selected=1 AND visibility='public') selected FROM items WHERE source_id=?",Date.now()-7*86400000,s.id);
    const history=await query(db,'SELECT id,datetime(created/1000,\'unixepoch\') created_at,\'管理员\' actor,action,reason,before_value before,after_value after FROM admin_audit WHERE subject=? ORDER BY id DESC LIMIT 30','source:'+s.id);
    return json({source:sourceView(s),runs:await query(db,"SELECT id,datetime(created/1000,'unixepoch') started_at,NULL finished_at,status,message error,NULL found_count,NULL new_count,NULL detail FROM runs WHERE source_id=? ORDER BY created DESC LIMIT 30",s.id),items,stats,history});
  }
  if(path==='/admin/models'&&!mutation) {
    const capabilities=await Promise.all(CAPABILITIES.map(async c=>{const model=await configuredModel(db,c.key);const usage=await query<{model:string;calls:number;ok:number;failed:number}>(db,"SELECT model,count(*) calls,sum(state='done') ok,sum(state='error') failed FROM receipts WHERE purpose=? AND day>=? GROUP BY model",c.key,utcDay(Date.now()-7*86400000));return {...c,defaultModel:c.key==='groupReview'?MODELS[1].key:MODELS[0].key,vision:false,current:{model:model.key,source:model.source},usage:usage.map(u=>({...u,purpose:c.key,promptVersion:'upstream-885b736-chat-json',unknown:0,p50:null,p95:null,tokensIn:0,tokensOut:0,actualCost:null,currency:null,estimate:null}))};}));
    const history=await query<{created:number;subject:string;reason:string;before_value:string;after_value:string}>(db,"SELECT * FROM admin_audit WHERE action='model' ORDER BY id DESC LIMIT 30");
    return json({days:7,capabilities,choices:MODELS.map(m=>({key:m.key,service:'Workers AI 免费额度',vision:false})),history:history.map(h=>({at:iso(h.created),actor:'管理员',subject:h.subject,reason:h.reason,before:JSON.parse(h.before_value),after:JSON.parse(h.after_value)})),benches:[]});
  }
  if(path==='/admin/audit'&&!mutation){const rows=await query<{id:number;action:string;subject:string;reason:string;before_value:string;after_value:string;created:number}>(db,'SELECT * FROM admin_audit ORDER BY id DESC LIMIT 100');return json({page:1,rows:rows.map(r=>({...r,actor:'管理员',created_at:iso(r.created),before:JSON.parse(r.before_value),after:JSON.parse(r.after_value)}))});}
  if(path==='/admin/content'&&!mutation){const rows=await query(db,`SELECT i.id,COALESCE(i.title_zh,i.title) title,i.url,datetime(i.discovered/1000,'unixepoch') discovered_at,i.stage processing_state,i.visibility,i.selected,(i.score1+i.score2)/2.0 score,s.name source FROM items i JOIN sources s ON s.id=i.source_id WHERE i.id=? OR i.url=? OR i.title LIKE ? OR i.title_zh LIKE ? ORDER BY i.discovered DESC LIMIT 100`,url.searchParams.get('q')||'',url.searchParams.get('q')||'','%'+(url.searchParams.get('q')||'')+'%','%'+(url.searchParams.get('q')||'')+'%');return json({rows});}
  if(path==='/admin/feedback'&&!mutation){const rows=await query<Record<string,any>>(db,'SELECT * FROM feedback ORDER BY created DESC LIMIT 100');const bans=await query<Record<string,any>>(db,'SELECT * FROM feedback_bans ORDER BY created DESC LIMIT 100');return json({page:1,rows:rows.filter(r=>!url.searchParams.get('status')||r.status===url.searchParams.get('status')).map(r=>({...r,content:r.message,page_url:safeUrl(r.page_url),screenshot:r.screenshot?'local':null,created_at:iso(r.created),updated_at:iso(r.updated),forwarded_at:null,forward_error:null,banned:bans.some(b=>b.source_hash===r.source_hash),from_source:rows.filter(f=>f.source_hash===r.source_hash).length})),counts:Object.fromEntries(['new','triaged','replied','resolved','spam'].map(st=>[st,rows.filter(r=>r.status===st).length])),bans:bans.map(b=>({...b,created_by:'管理员',created_at:iso(b.created)}))});}
  if(path==='/admin/settings'&&!mutation){const budget=await one<{reserved:number}>(db,'SELECT reserved FROM budgets WHERE day=?',utcDay()),config=await budgetConfig(db,Number(env.DAILY_NEURON_BUDGET)||0);const contacts=await query<{key:string;value:string}>(db,"SELECT * FROM settings WHERE key LIKE 'contact:%'");const hour=await one<{n:number}>(db,'SELECT COALESCE(sum(cost),0) n FROM budget_calls WHERE created>?',Date.now()-3600000);return json({contact:{wechatQr:contacts.find(c=>c.key==='contact:wechatQr')?.value||'',feishuQr:contacts.find(c=>c.key==='contact:feishuQr')?.value||''},targets:[],budgets:[{service:'Workers AI (Neurons)',per_minute:config.perMinute,per_hour:config.perHour,per_day:config.perDay,note:'免费整理预算；达到上限暂停，UTC 零点恢复。',updated_at:iso(config.updated),used_day:budget?.reserved??0,used_hour:hour?.n??0}]});}

  if(path==='/admin/runs'&&!mutation)return json(await runView(db));
  const contentMatch=/^\/admin\/content\/([a-zA-Z0-9_-]{1,80})(?:\/(.*))?$/.exec(path);
  if(contentMatch&&!mutation){const chain=await contentChain(db,contentMatch[1]);return chain?json(chain):json({detail:'内容不存在'},404);}
  const benchMatch=/^\/admin\/selectbench\/([a-zA-Z0-9_-]{1,80})$/.exec(path);
  if(path==='/admin/selectbench'&&!mutation){const rows=await query<Record<string,any>>(db,'SELECT * FROM selectbenches ORDER BY created DESC LIMIT 50');return json({runs:rows.map(r=>bench(r).run)});}
  if(benchMatch&&!mutation){const row=await one<Record<string,any>>(db,'SELECT * FROM selectbenches WHERE id=?',benchMatch[1]);if(!row)return json({detail:'评测报告不存在'},404);const b=bench(row),model=url.searchParams.get('model')||b.run.models[0],outcome=url.searchParams.get('outcome');b.rows=b.rows.filter(r=>{const decision=r.by_model[model];if(url.searchParams.get('stratum')&&r.stratum!==url.searchParams.get('stratum'))return false;if(url.searchParams.get('disagree')&&new Set(Object.values(r.by_model).map((d:any)=>d.decision)).size<=1)return false;return !outcome||outcome==='either'&&r.gold==='either'||outcome==='error'&&!decision?.decision||outcome==='fp'&&decision?.decision==='select'&&r.gold==='reject'||outcome==='fn'&&decision?.decision==='reject'&&r.gold==='select'||outcome==='tp'&&decision?.decision==='select'&&r.gold==='select'||outcome==='tn'&&decision?.decision==='reject'&&r.gold==='reject';});return json(b);}
  const fbMatch=/^\/admin\/feedback\/([a-zA-Z0-9_-]{1,80})(?:\/(.*))?$/.exec(path);
  if(fbMatch&&!mutation&&fbMatch[2]==='screenshot'){const r=await one<{screenshot:string}>(db,'SELECT screenshot FROM feedback WHERE id=?',fbMatch[1]);if(!r?.screenshot)return json({detail:'截图不存在'},404);const parts=/^data:(image\/(?:png|jpeg|webp));base64,(.*)$/.exec(r.screenshot);if(!parts)return json({detail:'截图不可用'},404);return new Response(Buffer.from(parts[2],'base64'),{headers:{'Content-Type':parts[1],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
  if(!mutation)return json({detail:'接口不存在'},404);

  let data:Record<string,unknown>;try{data=request.body?await payload(request,1000000):{};}catch{return json({detail:'请求格式错误或内容过大'},400);}
  const command=request.headers.get('Idempotency-Key');if(!command||command.length>100)return json({detail:'缺少操作回执编号'},400);
  const prior=await one<{result:string}>(db,'SELECT result FROM admin_commands WHERE key=?',request.method+':'+path+':'+command);if(prior)return json(JSON.parse(prior.result));
  const modelMatch=/^\/admin\/models\/([a-zA-Z]+)$/.exec(path);
  if(modelMatch){const cap=CAPABILITIES.find(c=>c.key===modelMatch[1]);if(!cap||data.model!==null&&!MODELS.some(m=>m.key===data.model))return json({detail:'请选择受免费预算保护的模型'},400);
    const before=await configuredModel(db,cap.key);if(data.model===null)await exec(db,'DELETE FROM settings WHERE key=?','model:'+cap.key);else await exec(db,'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','model:'+cap.key,data.model);
    const after=await configuredModel(db,cap.key);await audit(db,'model','capability:'+cap.key,{model:before.key,source:before.source},{model:after.key,source:after.source},data.reason);
  } else if(path==='/admin/sources/preview'||srcMatch?.[2]==='preview') {
    const source=srcMatch?.[2]?await one<SourceRow>(db,'SELECT * FROM sources WHERE id=?',srcMatch[1]):null;
    const config=(source?JSON.parse(source.config):data.config) as Record<string,unknown>;
    const feed=safeUrl(config?.feedUrl);if(!feed||!preview)return json({detail:'RSS/Atom 地址或预览配置无效'},400);
    try{return json(await preview(feed));}catch(e){return json({detail:String(e).slice(0,300)},422);}
  } else if(path==='/admin/sources'&&request.method==='POST') {
    if(typeof data.id!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(data.id)||typeof data.name!=='string'||!data.name.trim())return json({detail:'信源 ID 或名称无效'},400);
    const config=data.config as Record<string,unknown>,feed=safeUrl(config?.feedUrl);
    if(data.kind!=='rss'||!feed)return json({detail:'本站自动采集使用 RSS/Atom，请填写有效的 HTTPS 订阅地址'},422);
    if(data.site_fulltext||data.syndicate_fulltext)return json({detail:'当前只支持摘要和原文链接'},422);
    const duplicate=await one<{id:string;name:string}>(db,'SELECT id,name FROM sources WHERE url=? OR id=?',feed,data.id);if(duplicate)return json({created:false,duplicate});
    if(!['editorial','hot_signal','isolated'].includes(String(data.participation_mode)))return json({detail:'参与方式无效'},400);
    await exec(db,'INSERT INTO sources(id,name,url,tier,kind,config,first_party,participation_mode,interval_minutes,source_tags,created,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',data.id,data.name.slice(0,150),feed,['T1','T1_5','T2','EXCLUDE_MP'].includes(String(data.tier))?data.tier:'T2','rss',JSON.stringify(config),Number(Boolean(data.first_party)),data.participation_mode,Math.min(1440,Math.max(120,Number(data.interval_minutes)||120)),JSON.stringify(Array.isArray(data.tags)?data.tags.filter(t=>typeof t==='string').slice(0,20):[]),Date.now(),Date.now());
    await audit(db,'source.create','source:'+data.id,null,data,data.reason);
  } else if(srcMatch) {
    const s=await one<SourceRow>(db,'SELECT * FROM sources WHERE id=?',srcMatch[1]);if(!s)return json({detail:'信源不存在'},404);
    const tail=srcMatch[2];
    if(tail==='fetch'||tail==='collect'){if(!s.enabled)return json({detail:'请先启用此信源'},409);await env.JOBS.send({kind:'source',id:s.id});}
    else if(!tail&&request.method==='PATCH') {
      if(typeof data.version!=='string'||data.version!==iso(s.version))return json({detail:'信源已被更新，请刷新后再保存'},409);
      const patch=data.patch as Record<string,unknown>;if(!patch||typeof patch!=='object')return json({detail:'缺少修改内容'},400);
      const config=patch.config as Record<string,unknown>|undefined;
      if(config&&!safeUrl(config.feedUrl))return json({detail:'RSS 地址须为 HTTPS'},400);
      if(patch.site_fulltext||patch.syndicate_fulltext)return json({detail:'当前只发布摘要和原文链接'},422);
      if(patch.participation_mode&&!['editorial','hot_signal','isolated'].includes(String(patch.participation_mode)))return json({detail:'参与方式无效'},400);
      const result=await exec(db,'UPDATE sources SET name=?,tier=?,interval_minutes=?,first_party=?,config=?,url=?,enabled=?,participation_mode=?,source_tags=?,version=? WHERE id=? AND version=?',typeof patch.name==='string'?patch.name.slice(0,150):s.name,['T1','T1_5','T2','EXCLUDE_MP'].includes(String(patch.tier))?patch.tier:s.tier,Math.min(1440,Math.max(120,Number(patch.interval_minutes)||s.interval_minutes)),typeof patch.first_party==='boolean'?Number(patch.first_party):s.first_party,config?JSON.stringify(config):s.config,config?safeUrl(config.feedUrl):s.url,typeof patch.enabled==='boolean'?Number(patch.enabled):s.enabled,patch.participation_mode||s.participation_mode,Array.isArray(patch.tags)?JSON.stringify(patch.tags.filter(t=>typeof t==='string').slice(0,20)):s.source_tags,Math.max(Date.now(),s.version+1),s.id,s.version);
      if(!result.meta.changes)return json({detail:'信源已被更新，请刷新后再保存'},409);
    } else return json({detail:'操作不存在'},404);
    await audit(db,'source.update','source:'+s.id,sourceView(s),data,data.reason);
  } else if(contentMatch) {
    const id=contentMatch[1],action=contentMatch[2],item=await one<Record<string,any>>(db,'SELECT * FROM items WHERE id=?',id);if(!item)return json({detail:'内容不存在'},404);
    const priorOverride=await one<{fields:string;base:string;version:number}>(db,'SELECT * FROM item_overrides WHERE item_id=?',id);
    if(action==='seo'){await exec(db,'UPDATE items SET indexable=?,revision=revision+1,updated=? WHERE id=?',Number(Boolean(data.indexed)),Date.now(),id);}
    else if(action==='visibility'||action==='override'){
      if(Number(data.version)!==(priorOverride?.version??0))return json({detail:'内容已被修改，请刷新后重试'},409);
      if(action==='visibility'&&!['public','withdrawn'].includes(String(data.visibility)))return json({detail:'公开范围无效'},400);
      if(action==='override'&&item.stage!=='done')return json({detail:'请先完成内容整理，再修改公开内容'},409);
      const fields:Record<string,unknown>={...JSON.parse(priorOverride?.fields||'{}'),...((action==='override'?data.fields:{}) as object)};
      const allowed=['title','summary','reason','category','tags','selected'];if(Object.keys(fields).some(k=>!allowed.includes(k)))return json({detail:'存在不支持的修改字段'},400);
      const base=priorOverride?JSON.parse(priorOverride.base):{title:item.title_zh,summary:item.summary_zh,reason:item.reason,category:item.category,tags:JSON.parse(item.tags),selected:Boolean(item.selected)};
      const clear=Array.isArray(data.clear)?data.clear.filter((k):k is string=>typeof k==='string'&&allowed.includes(k)):[];
      for(const k of clear)delete fields[k];
      const current={title:item.title_zh,summary:item.summary_zh,reason:item.reason,category:item.category,tags:JSON.parse(item.tags),selected:Boolean(item.selected)};
      for(const k of clear)current[k as keyof typeof current]=base[k];
      const next={...current,...fields};
      if(typeof next.title!=='string'||!next.title.trim()||next.title.length>240||typeof next.summary!=='string'||next.summary.length>2400||typeof next.reason!=='string'&&next.reason!==null||!CATEGORY_KEYS.includes(next.category as never)||!Array.isArray(next.tags)||next.tags.some(t=>typeof t!=='string'||t.length>80)||next.tags.length>20||typeof next.selected!=='boolean')return json({detail:'标题、摘要、分类、标签或精选格式无效'},400);
      const now=Date.now(),version=(priorOverride?.version??0)+1;
      const results=await db.batch([
        db.prepare('UPDATE items SET title_zh=?,summary_zh=?,reason=?,category=?,tags=?,selected=?,visibility=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(next.title,next.summary,next.reason,next.category,JSON.stringify(next.tags),Number(next.selected),action==='visibility'?data.visibility:item.visibility,now,id,item.revision),
        db.prepare('INSERT INTO item_overrides(item_id,fields,base,reason,version,updated) SELECT ?,?,?,?,?,? WHERE changes()=1 ON CONFLICT(item_id) DO UPDATE SET fields=excluded.fields,reason=excluded.reason,version=excluded.version,updated=excluded.updated').bind(id,JSON.stringify(fields),JSON.stringify(base),typeof data.reason==='string'?data.reason.slice(0,500):null,version,now)
      ]);if(!results[0].meta.changes)return json({detail:'内容正在更新，请刷新后重试'},409);
    } else if(action==='rerun'){
      if(!['analyze','extract','group'].includes(String(data.step)))return json({detail:'处理步骤无效'},400);
      if(data.step!=='group'){
        const source=await one<SourceRow>(db,'SELECT * FROM sources WHERE id=?',item.source_id);if(!source||!preview)return json({detail:'信源无法读取'},422);
        try{const found=await preview(source.url);const original=found.items.find(i=>i.url===item.url);if(!original?.body)return json({detail:'当前订阅已不含此文；未使用缺少正文的资料重新评分'},422);await exec(db,"UPDATE items SET body=?,revision=revision+1,stage='prefilter',error=NULL,next_attempt=0 WHERE id=?",original.body,id);}catch(e){return json({detail:String(e).slice(0,300)},422);}
      }else await exec(db,"UPDATE items SET group_pending=1,group_next_attempt=0 WHERE id=?",id);
      await env.JOBS.send({kind:data.step==='group'?'group':'item',id});
    } else if(action==='detach'){
      const now=Date.now();const detached=id+'-manual-'+crypto.randomUUID().slice(0,8);await db.batch([db.prepare('INSERT OR IGNORE INTO stories(id,title,root_fact_id,created) VALUES(?,?,?,?)').bind(detached,item.title_zh??item.title,detached,now),db.prepare('INSERT OR IGNORE INTO events(id,title,category,created,story_id) VALUES(?,?,?,?,?)').bind(detached,item.title_zh??item.title,item.category,now,detached),db.prepare('UPDATE items SET event_id=?,revision=revision+1,updated=? WHERE id=?').bind(detached,now,id)]);
    } else return json({detail:'操作不存在'},404);
    await audit(db,'content.'+action,'content:'+id,{revision:item.revision,visibility:item.visibility},data,data.reason);
  } else if(path==='/admin/stories/merge') {
    if(typeof data.from!=='string'||typeof data.into!=='string'||data.from===data.into)return json({detail:'请输入另一个事件的 ID'},400);
    const target=await one(db,'SELECT id FROM stories WHERE id=?',data.into);if(!target)return json({detail:'目标事件不存在'},404);
    await exec(db,'UPDATE events SET story_id=? WHERE story_id=?',data.into,data.from);await audit(db,'story.merge','story:'+data.from,{from:data.from},{into:data.into},data.reason);
  } else if(fbMatch) {
    const f=await one<{id:string;updated:number;status:string;note:string|null}>(db,'SELECT * FROM feedback WHERE id=?',fbMatch[1]);if(!f)return json({detail:'反馈不存在'},404);
    if(fbMatch[2]==='erase'){await exec(db,'DELETE FROM feedback WHERE id=?',f.id);await audit(db,'feedback.erase','feedback:'+f.id,null,{erased:true},data.reason);}
    else if(request.method==='PATCH'&&!fbMatch[2]){if(data.version!==iso(f.updated))return json({detail:'反馈已被修改，请刷新后重试'},409);if(data.status&&!['new','triaged','replied','resolved','spam'].includes(String(data.status)))return json({detail:'状态无效'},400);if(data.note!==undefined&&data.note!==null&&typeof data.note!=='string')return json({detail:'备注无效'},400);const r=await exec(db,'UPDATE feedback SET status=?,note=?,updated=?,version=version+1 WHERE id=? AND updated=?',data.status||f.status,data.note===undefined?f.note:typeof data.note==='string'?data.note.slice(0,2000):null,Math.max(Date.now(),f.updated+1),f.id,f.updated);if(!r.meta.changes)return json({detail:'反馈已被修改，请刷新后重试'},409);}
    else return json({detail:'操作不存在'},404);
  } else if(path==='/admin/feedback-bans'&&request.method==='POST'){
    if(typeof data.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(data.sourceHash))return json({detail:'来源标识无效'},400);
    await exec(db,'INSERT OR REPLACE INTO feedback_bans(source_hash,reason,created) VALUES(?,?,?)',data.sourceHash,typeof data.reason==='string'?data.reason.slice(0,500):null,Date.now());
  } else if(path.startsWith('/admin/feedback-bans/')&&request.method==='DELETE')await exec(db,'DELETE FROM feedback_bans WHERE source_hash=?',decodeURIComponent(path.slice(21)));
  else if(path==='/admin/selectbench/import'){
    const report=data.report as Record<string,any>;if(!report||typeof report!=='object'||Array.isArray(report))return json({detail:'评测报告格式无效'},400);
    const models=report.models??Object.fromEntries(Object.entries(report).filter(([k])=>k!=='meta')),names=Object.keys(models);
    if(!names.length||names.length>10||names.some(m=>!models[m]?.summary||!Array.isArray(models[m].cases)||models[m].cases.length>500||models[m].cases.some((c:any)=>!c||typeof c.caseId!=='string'||typeof c.title!=='string'||!['select','reject','either'].includes(c.gold))))return json({detail:'须为含 summary 和逐条 cases 的评测报告（最多 10 模型、每模型 500 条）'},400);
    const id='sb-'+crypto.randomUUID();data.id=id;await exec(db,'INSERT INTO selectbenches(id,label,report,created) VALUES(?,?,?,?)',id,String(data.label||'导入评测').slice(0,150),JSON.stringify(report),Date.now());await audit(db,'selectbench.import','selectbench:'+id,null,{models:names},null);
  } else if(path==='/admin/settings/contact-qr') {
    if(!['wechatQr','feishuQr'].includes(String(data.slot))||typeof data.image!=='string'||data.image.length>350000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data.image))return json({detail:'二维码须为 PNG、JPEG 或 WebP，且小于 256 KB'},400);
    await exec(db,'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','contact:'+data.slot,data.image);await audit(db,'contact.qr','contact:'+data.slot,null,{updated:true},null);
  } else if(path.startsWith('/admin/budgets/')) {
    if(decodeURIComponent(path.slice(15))!=='Workers AI (Neurons)'||![data.perMinute,data.perHour,data.perDay].every(n=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<=6000))return json({detail:'本站预算只能在 0 至 6000 Neurons 内调整'},400);
    await exec(db,"INSERT INTO settings(key,value) VALUES('neuron_budget',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify({perMinute:data.perMinute,perHour:data.perHour,perDay:data.perDay,updated:Date.now()}));await audit(db,'budget','Workers AI',null,data,data.reason);
  } else if(path==='/admin/processing/requeue'){
    const items=await query<{id:string}>(db,"SELECT id FROM items WHERE stage='failed' LIMIT 24");for(const item of items){await exec(db,"UPDATE items SET stage=CASE WHEN title_zh IS NOT NULL THEN 'cluster' WHEN score2 IS NOT NULL THEN 'understand' WHEN score1 IS NOT NULL THEN 'score2' ELSE 'prefilter' END,error=NULL,next_attempt=0 WHERE id=?",item.id);await env.JOBS.send({kind:'item',id:item.id});}await audit(db,'processing.requeue','processing',null,{count:items.length},data.reason);
  } else return json({detail:'操作不存在'},404);
  const result={ok:true,id:data.id,created:path==='/admin/sources',source:data.id?{id:data.id}:undefined};await exec(db,'INSERT OR IGNORE INTO admin_commands(key,result,created) VALUES(?,?,?)',request.method+':'+path+':'+command,JSON.stringify(result),Date.now());return json(result);
}
