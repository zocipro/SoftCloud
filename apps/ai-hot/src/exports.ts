import { query,one,summary,readRows,readItem,hot,story,readReport,SITE_PATH,iso } from './publication.ts';
import { isCategoryKey } from '../contracts/src/taxonomy.ts';
export class InvalidCursor extends Error {}
const encode=(v:Record<string,unknown>)=>'sc1.'+Buffer.from(JSON.stringify(v)).toString('base64url');
const decode=(s:string):Record<string,unknown>=>{try{if(!s.startsWith('sc1.')||s.length>1024)throw Error();return JSON.parse(Buffer.from(s.slice(4),'base64url').toString());}catch{throw new InvalidCursor('游标无效，请重新获取首页');}};
export function v1Item(row:Parameters<typeof summary>[0],origin='https://zoci.pro') {
  const i=summary(row);return {id:i.id,title:i.title,originalTitle:i.originalTitle,summary:i.summary,source:{name:i.source.name},publishedAt:i.publishedAt,discoveredAt:i.discoveredAt,category:i.category,score:i.score,selected:i.selected,reason:i.reason,links:{aihot:origin+i.links.aihot,original:i.links.original}};
}
export interface ItemQuery {mode:'selected'|'all';window:'24h'|'7d';by:'timeline'|'published';category:string|null;q:string|null;limit:number;cursor:string|null;}
export async function v1Items(db:D1Database,q:ItemQuery,origin='https://zoci.pro') {
  if(q.q!==null&&(q.q.length<2||q.q.length>200))throw new InvalidCursor('关键词须为 2 至 200 个字符');
  if(!Number.isInteger(q.limit)||q.limit<1||q.limit>100||!['selected','all'].includes(q.mode)||!['24h','7d'].includes(q.window)||!['timeline','published'].includes(q.by)||q.category&&!isCategoryKey(q.category))throw new InvalidCursor('查询参数无效');
  const binding=JSON.stringify({...q,limit:0,cursor:null});const after=q.cursor?decode(q.cursor):null;
  if(after&&(after.b!==binding||typeof after.a!=='number'||typeof after.i!=='string'))throw new InvalidCursor('游标与查询不匹配');
  const u=new URL(origin);if(q.category)u.searchParams.set('category',q.category);if(q.q)u.searchParams.set('q',q.q);
  const all=await readRows(db,u,q.mode==='selected',500);
  const start=Date.now()-(q.window==='24h'?86400000:7*86400000);
  if(after&&Number(after.a)<start)throw new InvalidCursor('时间窗口已移动，请重新取得首页');
  const rows=all.filter(r=>r.published>=start&&r.published<=Date.now()&&(!after||r.published<Number(after.a)||r.published===Number(after.a)&&r.id<String(after.i)));
  const page=rows.slice(0,q.limit),more=rows.length>q.limit;
  return {schemaVersion:1 as const,query:{mode:q.mode,category:q.category,window:q.window,q:q.q,by:q.by,ordering:q.by==='published'?'publishedAtDesc':'timelineDesc'},items:page.map(r=>v1Item(r,origin)),page:{count:page.length,hasMore:more,nextCursor:more?encode({b:binding,a:page.at(-1)!.published,i:page.at(-1)!.id}):null}};
}
export async function v1Hot(db:D1Database,origin='https://zoci.pro') {
  const r=await hot(db);return {schemaVersion:1 as const,computedAt:r.computedAt,count:r.entries.length,items:r.entries.map(e=>({rank:e.rank,id:e.representative?.id??e.story.publicId,title:e.story.title,source:{name:e.representative?.sourceName??''},signalCount:e.signalCount,participantCount:e.participantCount,summary:e.summary,sourceNames:e.sourceNames,sourceCount:e.sourceCount,reportCount:e.reportCount,latestAt:e.latestAt,links:{aihot:origin+SITE_PATH+'/items/'+e.representative?.id,original:e.representative?.url??'',story:origin+SITE_PATH+'/story/'+e.story.publicId}}))};
}
export async function v1Story(db:D1Database,id:string,origin='https://zoci.pro') {
  const r=await story(db,id);if(!r)return null;return {schemaVersion:1 as const,story:{...r,status:r.status==='settled'?'settled':'active',latest:r.latest??r.excerpt?.text??'',storyline:[],reports:r.timeline.map(t=>({...t,links:{aihot:origin+SITE_PATH+'/items/'+t.id,original:t.originalUrl}})),links:{aihot:origin+SITE_PATH+'/story/'+id}}};
}
export async function v1Daily(db:D1Database,date:string,origin='https://zoci.pro') {
  const r=await readReport(db,'daily',date==='latest'?undefined:date);if(!r)return null;
  return {schemaVersion:1 as const,report:{...r,date:r.key,sections:r.sections.map(s=>({...s,items:s.items.map(i=>({...i,summary:i.summary??'',source:{name:i.sourceName},links:{aihot:i.itemId?origin+SITE_PATH+'/items/'+i.itemId:null,original:i.sourceUrl}}))})),links:{aihot:origin+SITE_PATH+'/daily/'+r.key}}};
}
export async function selectedSnapshot(db:D1Database,url:URL) {
  const pageToken=url.searchParams.get('page');const page=pageToken?decode(pageToken):null;
  const fields=url.searchParams.get('fields')??(page?.f as string)??'default';
  if(!['default','minimal'].includes(fields)||page&&(page.k!=='page'||page.f!==fields||typeof page.w!=='number'||typeof page.a!=='string'))throw new InvalidCursor('快照游标无效');
  const max=await one<{w:number}>(db,'SELECT coalesce(max(seq),0) w FROM selected_ledger');
  const w=page?Number(page.w):max?.w??0,after=page?String(page.a):'',asOf=page?String(page.t):iso(Date.now());
  const limit=Number(url.searchParams.get('limit')??100);if(!Number.isInteger(limit)||limit<1||limit>500)throw new InvalidCursor('limit 必须是 1 至 500 的整数');
  const rows=await query<{seq:number;item_id:string;payload:string}>(db,"SELECT l.* FROM selected_ledger l JOIN items i ON i.id=l.item_id WHERE l.seq=(SELECT max(seq) FROM selected_ledger WHERE item_id=l.item_id AND seq<=?) AND l.op='upsert' AND i.visibility='public' AND i.stage='done' AND i.selected=1 AND i.archived=0 AND l.item_id>? ORDER BY l.item_id LIMIT ?",w,after,limit+1);
  const result=rows.slice(0,limit);return {schemaVersion:1,asOf,fields,cursor:encode({k:'sync',w,f:fields}),count:result.length,hasMore:rows.length>limit,nextPage:rows.length>limit?encode({k:'page',w,f:fields,a:result.at(-1)!.item_id,t:asOf}):null,items:result.map(r=>projection(JSON.parse(r.payload),fields))};
}
function projection(item:Record<string,unknown>,fields:string){if(fields!=='minimal')return item;return {id:item.id,title:item.title,source:item.source,publishedAt:item.publishedAt,category:item.category,score:item.score,links:item.links};}
export async function selectedChanges(db:D1Database,url:URL) {
  const c=decode(url.searchParams.get('cursor')||'');const max=await one<{w:number}>(db,'SELECT coalesce(max(seq),0) w FROM selected_ledger');
  if(c.k!=='sync'||typeof c.w!=='number'||c.w<0||c.w>(max?.w??0)||!['default','minimal'].includes(String(c.f)))throw new InvalidCursor('请重新取得精选快照');
  const limit=Number(url.searchParams.get('limit')??100);if(!Number.isInteger(limit)||limit<1||limit>500)throw new InvalidCursor('limit 必须是 1 至 500 的整数');
  const rows=await query<{seq:number;item_id:string;op:string;payload:string;changed:number}>(db,"SELECT l.seq,l.item_id,CASE WHEN l.op='upsert' AND NOT EXISTS(SELECT 1 FROM items i WHERE i.id=l.item_id AND i.visibility='public' AND i.stage='done' AND i.selected=1 AND i.archived=0) THEN 'remove' ELSE l.op END op,l.payload,l.changed FROM selected_ledger l WHERE l.seq>? ORDER BY l.seq LIMIT ?",c.w,limit+1);const page=rows.slice(0,limit);
  return {schemaVersion:1,fields:c.f,cursor:encode({k:'sync',w:page.at(-1)?.seq??c.w,f:c.f}),count:page.length,hasMore:rows.length>limit,changes:page.map(r=>r.op==='remove'?{op:'remove',changedAt:iso(r.changed),id:r.item_id}:{op:'upsert',changedAt:iso(r.changed),item:projection(JSON.parse(r.payload),String(c.f))})};
}
