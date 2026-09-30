import openapi from '../upstream/public-v1.openapi.json';
import {v1Items,v1Hot,v1Story,v1Daily,selectedSnapshot,selectedChanges,InvalidCursor} from './exports.ts';
import { query, one, summary, detail, readItem, readRows, pool, timeline, hot, story, topicIndex, topicPage, reportIndex, readReport, stats, iso, SITE_PATH } from './publication.ts';
import type { ReportKind } from '../contracts/src/site.ts';
import { esc, beijingDay } from './core.mjs';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const missing=()=>json({code:'not_found',detail:'内容不存在'},404);
const kindOf=(s:string):ReportKind|null=>['daily','weekly','monthly'].includes(s)?s as ReportKind:null;

export async function siteApi(request:Request,env:Env,path:string):Promise<Response|null> {
  const db=env.DB,url=new URL(request.url);
  if(path==='/openapi-v1.json')return json(openapi);
  if(path==='/health')return json({status:'ok',time:iso(Date.now())});
  if(path==='/site/meta')return json({changelogVersion:'2026-09-30-original-ui'});
  if(path==='/site/contact'){const rows=await query<{key:string;value:string}>(db,"SELECT * FROM settings WHERE key LIKE 'contact:%'");return json({wechatQr:rows.find(r=>r.key==='contact:wechatQr')?.value||null,feishuQr:rows.find(r=>r.key==='contact:feishuQr')?.value||null,makerAvatar:null});}
  if(path==='/site/stats')return json(await stats(db));
  if(path==='/site/changelog')return json({latestVersion:'2026-09-30-original-ui',releases:[{date:'2026-09-30',time:'',kind:'更新',title:'接回原版阅读界面',body:['恢复原版导航、资讯列表、站内阅读、专题、收藏与报告阅读页；配色与品牌沿用软云官网。','采集和模型整理仍使用本站配置的信源与 Cloudflare 免费额度，内容数量与原站独立。']}]});
  if(path==='/site/timeline')return json(await timeline(db,url));
  if(path==='/site/pool')return json(await pool(db,url));
  if(path==='/site/hot')return json(await hot(db));
  if(path==='/site/topics')return json({topics:await topicIndex(db)});
  if(path.startsWith('/site/topics/')){const r=await topicPage(db,decodeURIComponent(path.slice(13)),url);return r?json(r):missing();}
  if(path==='/site/items/availability') {
    const ids=(url.searchParams.get('ids')||'').split(',').filter(id=>/^[a-zA-Z0-9_-]{1,80}$/.test(id)).slice(0,500);
    const rows=ids.length?await query<{id:string}>(db,`SELECT id FROM items WHERE stage='done' AND visibility='public' AND id IN (${ids.map(()=>'?').join(',')})`,...ids):[];
    const found=new Set(rows.map(r=>r.id));return json(Object.fromEntries(ids.map(id=>[id,found.has(id)?'available':'gone'])));
  }
  const itemMatch=/^\/site\/items\/([a-zA-Z0-9_-]{1,80})(\/original)?$/.exec(path);
  if(itemMatch){const item=await detail(db,itemMatch[1]);return item?json(item):missing();}
  const groupMatch=/^\/site\/groups\/([a-zA-Z0-9_-]{1,80})\/reports$/.exec(path);
  if(groupMatch) {
    const rows=await query<{id:string}>(db,"SELECT id FROM items WHERE stage='done' AND visibility='public' AND event_id=? ORDER BY published DESC LIMIT 100",groupMatch[1]);
    if(!rows.length)return missing();
    const reports=await Promise.all(rows.map(async r=>{const i=(await readItem(db,r.id))!;return{id:i.id,title:i.title_zh??i.title,summary:i.summary_zh,source:summary(i).source,timelineAt:iso(i.published),originalUrl:i.url,selected:Boolean(i.selected)};}));
    return json({factId:groupMatch[1],revision:'1',reports,nextCursor:null});
  }
  const storyMatch=/^\/site\/stories\/([a-zA-Z0-9_-]{1,80})(\/followups|\/developments)?$/.exec(path);
  if(storyMatch){const r=await story(db,storyMatch[1]);if(!r)return missing();if(storyMatch[2]==='/followups')return json({items:await Promise.all(r.developments.map(async d=>({...d,representative:summary((await readItem(db,d.representative.id))!)}))),more:false});if(storyMatch[2]==='/developments')return json({story:{publicId:r.publicId,title:r.title},revision:'1',developments:await Promise.all(r.developments.map(async d=>({...d,representative:summary((await readItem(db,d.representative.id))!)}))),nextCursor:null});return json(r);}
  const reportMatch=/^\/site\/reports\/(daily|weekly|monthly)(?:\/(.*))?$/.exec(path);
  if(reportMatch){const kind=kindOf(reportMatch[1])!,tail=reportMatch[2];const index=await reportIndex(db,kind);
    if(!tail||tail.startsWith('navigation/'))return json({items:index});
    if(tail==='latest-page')return json({index,report:await readReport(db,kind)});
    if(tail.startsWith('months/'))return json({items:index.filter(r=>r.key.startsWith(tail.slice(7)))});
    const r=await readReport(db,kind,tail);return r?json(r):missing();
  }
  // All syndicated exports read the same completed, public articles as the reader UI.
  if(['/feed.xml','/feed/full.xml','/feed/all.xml','/feed/daily.xml'].includes(path)) {
    const base=new URL(request.url).origin;
    let entries:string[];
    if(path==='/feed/daily.xml') {const reports=await reportIndex(db,'daily');entries=await Promise.all(reports.slice(0,30).map(async e=>{const r=(await readReport(db,'daily',e.key))!;return `<item><title>${esc(r.title)}</title><link>${base+SITE_PATH}/daily/${esc(r.key)}</link><guid>${base+SITE_PATH}/daily/${esc(r.key)}</guid><description>${esc(r.lead?.leadParagraph)}</description><pubDate>${new Date(r.generatedAt).toUTCString()}</pubDate></item>`;}));}
    else {const rows=await readRows(db,url,path!=='/feed/all.xml',50);entries=rows.filter(r=>path!=='/feed/all.xml'||r.published>Date.now()-7*86400000).map(r=>`<item><title>${esc(r.title_zh??r.title)}</title><link>${base+SITE_PATH}/items/${r.id}</link><guid isPermaLink="false">${r.id}</guid><description>${esc(r.summary_zh)}</description><pubDate>${new Date(r.published).toUTCString()}</pubDate><source url="${esc(r.url)}">${esc(r.source_name)}</source></item>`);}
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>软云 AI 热点</title><link>${base+SITE_PATH}/</link><description>本站配置的 AI 行业信源与精选摘要，全文再分发默认关闭</description>${entries.join('')}</channel></rss>`,{headers:{'Content-Type':'application/rss+xml; charset=utf-8'}});
  }
  if(path==='/llms.txt')return new Response(`# 软云 AI 热点\n\nSite: ${url.origin+SITE_PATH}/\nAPI: ${url.origin}/api/ai-hot/v1/items\nMCP: ${url.origin}/api/ai-hot/mcp\nRSS: ${url.origin}/api/ai-hot/feed.xml\n\nThis site publishes AI-curated summaries from its configured sources. AI summaries may contain errors; cite the original source. Public page reads do not invoke models. Source full-text republication is disabled by default.\n`,{headers:{'Content-Type':'text/plain; charset=utf-8'}});
  if(path.startsWith('/items/')&&path.endsWith('.md')){const r=await readItem(db,path.slice(7,-3));if(!r)return missing();return new Response(`# ${r.title_zh??r.title}\n\n${r.summary_zh??''}\n\n来源：[${r.source_name}](${r.url})\n\n${iso(r.published)}\n`,{headers:{'Content-Type':'text/markdown; charset=utf-8'}});}
  if(path==='/v1/items') {
    try{return json(await v1Items(db,{mode:(url.searchParams.get('mode')||'selected') as 'selected'|'all',window:(url.searchParams.get('window')||'24h') as '24h'|'7d',by:(url.searchParams.get('by')||'timeline') as 'timeline'|'published',category:url.searchParams.get('category'),q:url.searchParams.get('q'),limit:Number(url.searchParams.get('limit')||20),cursor:url.searchParams.get('cursor')},url.origin));}catch(e){if(e instanceof InvalidCursor)return json({code:'invalid_request',detail:e.message},400);throw e;}
  }
  if(path==='/v1/selected/snapshot'||path==='/v1/selected/changes'){try{return json(await (path.endsWith('snapshot')?selectedSnapshot(db,url):selectedChanges(db,url)));}catch(e){if(e instanceof InvalidCursor)return json({code:'snapshot_required',detail:e.message},400);throw e;}}
  if(path.startsWith('/v1/items/')&&path.endsWith('.md'))return siteApi(request,env,'/items/'+path.slice(10));
  if(path.startsWith('/v1/items/')){const item=await detail(db,path.slice(10));return item?json(item):missing();}
  if(path==='/v1/hot-topics')return json(await v1Hot(db,url.origin));
  if(path.startsWith('/v1/stories/')){const r=await v1Story(db,path.slice(12),url.origin);return r?json(r):missing();}
  if(path==='/v1/dailies'){const reports=await query<{date:string;title:string;lead:string;created:number}>(db,'SELECT * FROM reports ORDER BY date DESC LIMIT 90');return json({schemaVersion:1,count:reports.length,items:reports.map(r=>({date:r.date,generatedAt:iso(r.created),leadTitle:r.title,leadParagraph:r.lead,links:{aihot:url.origin+SITE_PATH+'/daily/'+r.date}}))});}
  if(path.startsWith('/v1/dailies/')){const r=await v1Daily(db,path.slice(12),url.origin);return r?json(r):missing();}
  return null;
}
