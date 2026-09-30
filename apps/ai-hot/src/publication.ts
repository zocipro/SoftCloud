import {periodWindow} from './periods.ts';
import type { ItemSummary, SiteItemDetail, TimelineResponse, PoolResponse, HotResponse, StoryDetail, GroupInfo, ReportDetail, ReportKind, ReportCitation, SiteStats } from '../contracts/src/site.ts';
import { isCategoryKey, isChannelKey } from '../contracts/src/taxonomy.ts';
import topics from '../upstream/topics.json';
import seed from '../upstream/sources.json';
import { CATEGORIES } from '../upstream/taxonomy.ts';
import { beijingDay, eventHeat, reportWindow } from './core.mjs';

export const SITE_PATH = '/tools/ai-hot';
export const query = async <T>(db: D1Database, sql: string, ...args: unknown[]) => (await db.prepare(sql).bind(...args).all<T>()).results;
export const one = <T>(db: D1Database, sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args).first<T>();
export interface PublicRow {
  id:string; source_id:string; url:string; title:string; published:number; discovered:number; archived:number;
  score1:number|null; score2:number|null; title_zh:string|null; summary_zh:string|null; reason:string|null;
  category:string; tags:string; selected:number; event_id:string|null; source_name:string; first_party:number;participation_mode:string; visibility:string; revision:number;story_id:string|null;story_title:string|null;indexable:number;
}
const columns = 'i.id,i.source_id,i.url,i.title,i.published,i.discovered,i.archived,i.score1,i.score2,i.title_zh,i.summary_zh,i.reason,i.category,i.tags,i.selected,i.event_id,s.name source_name,s.first_party,s.participation_mode,i.visibility,i.revision,i.indexable,(SELECT story_id FROM events WHERE id=i.event_id) story_id,(SELECT title FROM stories WHERE id=(SELECT story_id FROM events WHERE id=i.event_id)) story_title';
const firstParty = (id:string) => seed.sources.find(s=>s.id===id)?.first_party ?? false;
export const iso = (time:number) => new Date(time).toISOString();
export function summary(row:PublicRow):ItemSummary {
  return {id:row.id, revision:row.revision, title:row.title_zh ?? row.title, originalTitle:row.title,
    summary:row.summary_zh, reason:row.reason, source:{id:row.source_id,name:row.source_name,kind:'rss',firstParty:Boolean(row.first_party),iconUrl:null},
    links:{aihot:`${SITE_PATH}/items/${row.id}`,original:row.url},publishedAt:iso(row.published),discoveredAt:iso(row.discovered),timelineAt:iso(row.published),
    category:isCategoryKey(row.category)?row.category:null,tags:JSON.parse(row.tags),score:row.score1===null||row.score2===null?null:(row.score1+row.score2)/2,
    selected:Boolean(row.selected),channel:'news',story:row.story_id?{publicId:row.story_id,title:row.story_title??row.title_zh??row.title}:null,x:null};
}
export function filters(url:URL) {
  const c=url.searchParams.get('channel'), cat=url.searchParams.get('category');
  return {channel:isChannelKey(c)?c:'all' as const,category:isCategoryKey(cat)?cat:null,tag:url.searchParams.get('tag')?.slice(0,80)||null};
}
function predicate(url:URL, selected:boolean, extra:string[] = []) {
  const f=filters(url);const clauses=["i.stage='done'","i.visibility='public'",...extra];const args:unknown[]=[];
  if(selected) clauses.push('i.selected=1','i.archived=0');
  if(f.channel==='x') clauses.push('0=1');
  if(f.channel==='firstParty') {
    clauses.push('i.source_id IN (SELECT id FROM sources WHERE first_party=1)');
  }
  if(f.category) {clauses.push('i.category=?');args.push(f.category);}
  if(f.tag) {clauses.push('EXISTS(SELECT 1 FROM json_each(i.tags) WHERE value=?)');args.push(f.tag);}
  const q=url.searchParams.get('q')?.trim().slice(0,200);
  if(q) {const like='%'+q.replace(/[\\%_]/g,'\\$&')+'%';clauses.push("(i.title_zh LIKE ? ESCAPE '\\' OR i.title LIKE ? ESCAPE '\\' OR i.summary_zh LIKE ? ESCAPE '\\')");args.push(like,like,like);}
  return {where:clauses.join(' AND '),args};
}
export async function readRows(db:D1Database,url:URL, selected=false, limit=30,offset=0):Promise<PublicRow[]> {
  const {where,args}=predicate(url,selected);
  const q=url.searchParams.get('q')?.trim().slice(0,200),relevance=q&&url.searchParams.get('tab')==='relevance';
  // Literal title matches come first; all ordering ends in the stable article id.
  const order=relevance?`CASE WHEN instr(lower(COALESCE(i.title_zh,'')||' '||i.title),lower(?))>0 THEN 0 ELSE 1 END,i.published DESC,i.id DESC`:'i.published DESC,i.id DESC';
  return query<PublicRow>(db,`SELECT ${columns} FROM items i JOIN sources s ON s.id=i.source_id WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,...args,...(relevance?[q]:[]),Math.min(limit,500),Math.min(offset,5000));
}
export async function readItem(db:D1Database,id:string):Promise<PublicRow|null> {
  return one<PublicRow>(db,`SELECT ${columns} FROM items i JOIN sources s ON s.id=i.source_id WHERE i.stage='done' AND i.visibility='public' AND i.id=?`,id);
}
export async function group(db:D1Database,row:PublicRow):Promise<GroupInfo|null> {
  if(!row.event_id)return null;
  const stats=await one<{count:number;sources:number}>(db,"SELECT count(*) count,count(DISTINCT source_id) sources FROM items WHERE stage='done' AND visibility='public' AND event_id=?",row.event_id);
  const developments=await one<{n:number}>(db,"SELECT count(DISTINCT i.event_id) n FROM items i JOIN events e ON e.id=i.event_id WHERE i.stage='done' AND i.visibility='public' AND e.story_id=?",row.story_id);
  return {factId:row.event_id,story:summary(row).story,additionalSourceCount:Math.max(0,(stats?.sources??1)-1),reportCount:stats?.count ?? 1,developmentCount:developments?.n??1};
}
export async function detail(db:D1Database,id:string):Promise<SiteItemDetail|null> {
  const row=await readItem(db,id);if(!row)return null;
  return {...summary(row),readingMode:'summary-only',author:null,language:null,body:null,outline:[],relatedStories:[],indexable:Boolean(row.indexable),markdownAvailable:true,group:await group(db,row),hasTranslation:false,bodyLanguage:'zh'};
}
export async function pool(db:D1Database,url:URL):Promise<PoolResponse> {
  const f=filters(url),{where,args}=predicate(url,false);
  const n=await one<{n:number;today:number;fresh:number|null}>(db,`SELECT count(*) n,sum(i.published>=?) today,max(i.discovered) fresh FROM items i WHERE ${where}`,Date.parse(beijingDay()+'T00:00:00+08:00'),...args);
  const page=Math.min(50,Math.max(1,Number.parseInt(url.searchParams.get('page')||'1')||1));
  return {filters:{...f,q:url.searchParams.get('q')?.trim().slice(0,200)||null,tab:url.searchParams.get('tab')==='relevance'?'relevance':'time'},items:(await readRows(db,url,false,30,(page-1)*30)).map(summary),page,pageCount:Math.max(1,Math.ceil((n?.n ?? 0)/30)),total:n?.n ?? 0,todayCount:n?.today ?? 0,freshness:iso(n?.fresh ?? Date.now()),generatedAt:iso(Date.now())};
}
export async function timeline(db:D1Database,url:URL):Promise<TimelineResponse> {
  const f=filters(url);const offset=Math.min(5000,Math.max(0,Number(url.searchParams.get('cursor'))||0));
  const {where,args}=predicate(url,true);
  const scope=`WITH scoped AS (SELECT ${columns},COALESCE((SELECT story_id FROM events WHERE id=i.event_id),i.id) group_key FROM items i JOIN sources s ON s.id=i.source_id WHERE ${where}),ranked AS (SELECT *,max(published) OVER(PARTITION BY group_key) anchor,row_number() OVER(PARTITION BY group_key ORDER BY first_party DESC,published ASC,id) representative FROM scoped)`;
  const rows=await query<PublicRow&{anchor:number}>(db,scope+' SELECT * FROM ranked WHERE representative=1 ORDER BY anchor DESC,id DESC LIMIT 31 OFFSET ?',...args,offset);
  const days=await query<{day:string;n:number}>(db,scope+" SELECT date(anchor/1000,'unixepoch','+8 hours') day,count(*) n FROM ranked WHERE representative=1 GROUP BY day ORDER BY day DESC LIMIT 90",...args);
  const cards=await Promise.all(rows.slice(0,30).map(async r=>({key:r.id,anchorAt:iso(r.anchor),item:summary(r),group:await group(db,r)})));
  return {filters:f,cards,nextCursor:rows.length>30?String(offset+30):null,refreshAt:null,hot:(await hot(db)).entries.slice(0,3).map(e=>({rank:e.rank,title:e.story.title,heat:e.heat,trend:e.trend,storyPublicId:e.story.publicId,itemId:e.representative?.id??null,participants:e.participants,participantCount:e.participantCount})),dayCounts:Object.fromEntries(days.map(d=>[d.day,d.n])),generatedAt:iso(Date.now())};
}
export async function hot(db:D1Database):Promise<HotResponse> {
  const rows=await query<PublicRow>(db,`SELECT ${columns} FROM items i JOIN sources s ON s.id=i.source_id WHERE i.stage='done' AND i.visibility='public' AND i.archived=0 AND s.participation_mode<>'isolated' AND i.published>? ORDER BY i.published DESC LIMIT 180`,Date.now()-48*3600000);
  const groups=new Map<string,PublicRow[]>();for(const row of rows){const id=row.story_id??row.event_id??row.id;groups.set(id,[...(groups.get(id)??[]),row]);}
  const entries=[...groups].map(([id,items])=>{const lead=items[0];const participants=[...new Map(items.map(i=>[i.source_id,{name:i.source_name,kind:(i.participation_mode==='hot_signal'?'signal':'editorial') as 'signal'|'editorial',iconUrl:null}])).values()];return {rank:0,story:{publicId:id,title:lead.story_title??lead.title_zh??lead.title},heat:Math.round(eventHeat(items)*100)/10,trend:'unknown' as const,trendPct:null,badges:[],participantCount:participants.length,sourceCount:participants.filter(p=>p.kind==='editorial').length,signalCount:participants.filter(p=>p.kind==='signal').length,reportCount:items.length,sourceNames:participants.map(p=>p.name),latestAt:iso(lead.published),firstReportAt:iso(items.at(-1)!.published),representative:{id:lead.id,url:lead.url,sourceName:lead.source_name},participants,spark:Array<number|null>(24).fill(null),summary:lead.summary_zh,latest:null,cover:null};}).filter(e=>e.participantCount>=2&&e.sourceCount>=1).sort((a,b)=>b.heat-a.heat).slice(0,10).map((e,i)=>({...e,rank:i+1}));
  return {computedAt:rows.length?iso(Date.now()):null,ruleVersion:'heat-v1-48h-halflife24h',windowHours:48,entries};
}
export async function story(db:D1Database,id:string):Promise<StoryDetail|null> {
  const rows=await query<PublicRow>(db,`SELECT ${columns} FROM items i JOIN sources s ON s.id=i.source_id WHERE i.stage='done' AND i.visibility='public' AND (SELECT story_id FROM events WHERE id=i.event_id)=? ORDER BY i.published DESC`,id);
  if(!rows.length)return null;const lead=rows[0];const reports=rows.map(r=>({id:r.id,title:r.title_zh??r.title,summary:r.summary_zh,source:summary(r).source,publishedAt:iso(r.published),timelineAt:iso(r.published),originalUrl:r.url,selected:Boolean(r.selected),factId:r.event_id??r.id,category:isCategoryKey(r.category)?r.category:null,tags:JSON.parse(r.tags)}));
  const facts=[...new Set(rows.map(r=>r.event_id??r.id))].map(factId=>{const members=rows.filter(r=>(r.event_id??r.id)===factId);return {factId,title:members.at(-1)!.title_zh??members.at(-1)!.title,occurredAt:null,firstReportAt:iso(members.at(-1)!.published),reportCount:members.length,representative:reports.find(r=>r.factId===factId)!};});
  return {publicId:id,title:lead.story_title??lead.title_zh??lead.title,status:'watching',reportCount:rows.length,sourceCount:new Set(rows.map(r=>r.source_id)).size,firstReportAt:iso(rows.at(-1)!.published),latestAt:iso(lead.published),digest:null,digestUpdatedAt:null,summary:null,excerpt:lead.summary_zh?{text:lead.summary_zh,sourceName:lead.source_name}:null,latest:null,whyHot:{participants48h:new Set(rows.map(r=>r.source_id)).size,newParticipants6h:0,recentReports24h:rows.filter(r=>r.published>Date.now()-86400000).length,observationComplete:false,rank:null,heat:null},developments:facts,officialReports:reports.filter(r=>r.source.firstParty),timeline:reports,heat:[],related:[]};
}
export async function topicIndex(db:D1Database) {
  const counts=await query<{slug:string;n:number;recent:number;latest:number|null}>(db,`WITH topic AS (SELECT json_extract(value,'$.slug') slug,json_extract(value,'$.tags') tags FROM json_each(?)) SELECT t.slug,count(i.id) n,sum(i.published>?) recent,max(i.published) latest FROM topic t LEFT JOIN items i ON i.stage='done' AND i.visibility='public' AND i.selected=1 AND i.archived=0 AND EXISTS(SELECT 1 FROM json_each(i.tags) x WHERE x.value IN (SELECT value FROM json_each(t.tags))) GROUP BY t.slug`,JSON.stringify(topics.topics),Date.now()-7*86400000);
  return topics.topics.map(t=>{const c=counts.find(c=>c.slug===t.slug);return {...t,total:c?.n??0,recent:c?.recent??0,indexable:(c?.n??0)>0,latestAt:c?.latest?iso(c.latest):null};});
}
export async function topicPage(db:D1Database,slug:string,url:URL) {
  const t=topics.topics.find(t=>t.slug===slug);if(!t)return null;
  const matches=`EXISTS(SELECT 1 FROM json_each(i.tags) WHERE value IN (${t.tags.map(()=>'?').join(',')}))`;
  const n=await one<{n:number}>(db,`SELECT count(*) n FROM items i WHERE i.stage='done' AND i.visibility='public' AND i.selected=1 AND i.archived=0 AND ${matches}`,...t.tags);
  const page=Math.min(50,Math.max(1,Number(url.searchParams.get('page'))||1));
  const rows=await query<PublicRow>(db,`SELECT ${columns} FROM items i JOIN sources s ON s.id=i.source_id WHERE i.stage='done' AND i.visibility='public' AND i.selected=1 AND i.archived=0 AND ${matches} ORDER BY i.published DESC,i.id DESC LIMIT 20 OFFSET ?`,...t.tags,(page-1)*20);
  return {topic:{...t,total:n?.n??0,indexable:Boolean(n?.n),related:topics.topics.filter(x=>t.related.includes(x.slug)).map(x=>({slug:x.slug,name:x.name}))},items:rows.map(summary),page,pageCount:Math.max(1,Math.ceil((n?.n??0)/20))};
}
export async function reportIndex(db:D1Database,kind:ReportKind) {
  if(kind!=='daily')return query<{key:string;title:string;generatedAt:string;count:number}>(db,"SELECT key,title,datetime(created/1000,'unixepoch') generatedAt,json_array_length(item_ids) count FROM period_reports WHERE kind=? ORDER BY key DESC LIMIT 60",kind);
  const rows=await query<{date:string;title:string;created:number;count:number}>(db,'SELECT date,title,created,json_array_length(item_ids) count FROM reports ORDER BY date DESC LIMIT 90');
  return rows.map(r=>({key:r.date,title:r.title,generatedAt:iso(r.created),count:r.count}));
}
export async function readReport(db:D1Database,kind:ReportKind,key?:string):Promise<ReportDetail|null> {
  const row=kind==='daily'?await one<{date:string;title:string;lead:string;item_ids:string;created:number}>(db,key?'SELECT * FROM reports WHERE date=?':'SELECT * FROM reports ORDER BY date DESC LIMIT 1',...(key?[key]:[])):await one<{date:string;title:string;lead:string;item_ids:string;created:number}>(db,key?'SELECT *,key date FROM period_reports WHERE kind=? AND key=?':'SELECT *,key date FROM period_reports WHERE kind=? ORDER BY key DESC LIMIT 1',kind,...(key?[key]:[]));
  if(!row)return null;const index=await reportIndex(db,kind);const position=index.findIndex(i=>i.key===row.date);
  const ids=JSON.parse(row.item_ids) as string[];const found=await Promise.all(ids.map(id=>readItem(db,id)));
  const citations:ReportCitation[]=ids.map((id,i)=>{const r=found[i];return {itemId:r?.id??null,title:r?.title_zh??r?.title??'内容已移除',summary:r?.summary_zh??null,sourceName:r?.source_name??'',sourceUrl:r?.url??'',sourceId:r?.source_id??null,sourceIconUrl:null,firstParty:Boolean(r?.first_party),role:null,storyPublicId:r?.story_id??null,publishedAt:r?iso(r.published):null,available:Boolean(r)};});
  let sections:Array<{label:string;summary:string|null;items:ReportCitation[]}>=CATEGORIES.map(c=>({label:c.label,summary:null as string|null,items:citations.filter((_,i)=>found[i]?.category===c.key)})).filter(s=>s.items.length);
  const window=kind==='daily'?reportWindow(row.date):periodWindow(kind,row.date);
  if(kind!=='daily'){const p=row as typeof row&{themes:string};const themes=JSON.parse(p.themes) as {heading:string;summary:string;refs:number[]}[];sections=themes.map(t=>({label:t.heading,summary:t.summary,items:t.refs.map(n=>citations[n-1]).filter(Boolean)}));}
  return {kind,key:row.date,title:row.title,windowStart:iso(window.start),windowEnd:iso(window.end),generatedAt:iso(row.created),revision:1,lead:{title:row.title,leadParagraph:row.lead},overview:null,highlights:citations.slice(0,3),sections,stories:sections.flatMap(s=>s.items.map(i=>({...i,label:s.label}))),flashes:[],cover:null,metrics:{selected:citations.length,sources:new Set(found.filter(Boolean).map(r=>r!.source_id)).size},readingMinutes:Math.max(1,Math.ceil(citations.length/3)),prev:index[position+1]?.key??null,next:position>0?index[position-1]?.key??null:null};
}
export async function stats(db:D1Database):Promise<SiteStats> {
  const sources=await query<{name:string;enabled:number}>(db,'SELECT name,enabled FROM sources WHERE enabled=1');
  const counts=await one<{n:number;selected:number;day:number;selected_day:number}>(db,"SELECT count(*) n,sum(stage='done' AND visibility='public' AND selected=1 AND archived=0) selected,sum(discovered>?) day,sum(stage='done' AND visibility='public' AND selected=1 AND published>?) selected_day FROM items",Date.now()-86400000,Date.now()-86400000);
  const reports=await one<{n:number}>(db,'SELECT count(*) n FROM reports');
  const latest=await readRows(db,new URL('https://zoci.pro'),true,6);
  return {sources:sources.length,sourceKinds:{rss:sources.length},heatOnlySources:0,items:counts?.n??0,selected:counts?.selected??0,dailies:reports?.n??0,day:{collected:counts?.day??0,selected:counts?.selected_day??0},sampleSources:sources.map(s=>({name:s.name,kind:'rss',heatOnly:false})),latest:latest.map(r=>({id:r.id,title:r.title_zh??r.title,source:r.source_name}))};
}
