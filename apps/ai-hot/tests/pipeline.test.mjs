import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker,{parseFeed,boundedFeed} from '../dist-test/worker.mjs';
import {eventHeat, isSelected, neuronReservation, reportWindow, archiveItem} from '../src/core.mjs';

class DB {
  constructor(){this.sqlite=new DatabaseSync(':memory:');for(const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())this.sqlite.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'))}
  prepare(sql){const db=this.sqlite;let args=[];const p={bind(...v){args=v;return p},async run(){const r=db.prepare(sql).run(...args);return{meta:{changes:Number(r.changes)}}},async first(){return db.prepare(sql).get(...args)||null},async all(){return{results:db.prepare(sql).all(...args)}}};return p}
  async batch(statements){this.sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());this.sqlite.exec('COMMIT');return results}catch(e){this.sqlite.exec('ROLLBACK');throw e}}
}
function environment(results=[]){const db=new DB();const jobs=[];const prompts=[];const env={DB:db,JOBS:{async send(job){jobs.push(job)}},AI:{async run(model,input){prompts.push(JSON.stringify(input.messages));assert.equal(input.response_format.type,'json_schema');assert.equal(input.messages[0].role,'system');assert.ok(input.messages[1].content.endsWith('/no_think'));const result=results.shift();if(result instanceof Error)throw result;if(!result)throw Error('unexpected model call');return{response:JSON.stringify(result)}}},COLLECT_ENABLED:'false',MODEL_CALLS_ENABLED:'true',FREE_PLAN_VERIFIED:'true',DAILY_NEURON_BUDGET:'6000',DAILY_ARTICLE_LIMIT:'24',SITE_URL:'https://zoci.pro/tools/ai-hot/'};return{env,db,jobs,prompts}}
async function addItem(db,overrides={}){await db.prepare('INSERT INTO sources(id,name,url,tier) VALUES(?,?,?,?)').bind('source','Official source','https://example.com/feed','T1').run();const row={id:'0123456789abcdef01234567',url:'https://example.com/news',title:'Release of a test AI model',body:'A test AI model is available in a public API. This fixture is not real news.',published:Date.now()-3600000,discovered:Date.now(),...overrides};await db.prepare('INSERT INTO items(id,source_id,url,title,body,published,discovered,stage) VALUES(?,?,?,?,?,?,?,?)').bind(row.id,'source',row.url,row.title,row.body,row.published,row.discovered,row.stage||'prefilter').run();return row}
async function consume(env,job){let ack=false,retry=false;await worker.queue({messages:[{body:job,attempts:1,ack(){ack=true},retry(){retry=true}}]},env);assert.equal(retry,false);assert.equal(ack,true)}
globalThis.caches={default:{async match(){return undefined},async put(){}}};
const ctx={waitUntil(p){p.catch(()=>{})}};
const get=(env,path,options)=>worker.fetch(new Request('https://zoci.pro/api/ai-hot'+path,options),env,ctx);

test('RSS and Atom keep HTTPS sources and reject script links',()=>{const rss=parseFeed('<rss><channel><item><title>A &amp; B&#039;s</title><link>https://example.com/a</link><description><![CDATA[<p>A useful summary</p>]]></description><pubDate>Tue, 29 Sep 2026 01:00:00 GMT</pubDate></item><item><title>Unsafe</title><link>javascript:alert(1)</link></item></channel></rss>');assert.equal(rss.length,1);assert.equal(rss[0].title,"A & B's");assert.equal(rss[0].body,'A useful summary');const atom=parseFeed('<feed><entry><title>Atom</title><link rel="self" href="https://example.com/raw"/><link rel="alternate" href="https://example.com/article"/><summary>Hello</summary></entry></feed>');assert.equal(atom[0].url,'https://example.com/article')});
test('two scores use exact thresholds without rounding into selection',()=>{assert.equal(isSelected(59,60,60),false);assert.equal(isSelected(59,61,60),true);assert.equal(isSelected(75,76,76),false);assert.equal(isSelected(null,80,60),false);assert.equal(isSelected(90,90,undefined),false)});
test('repeat publications from one source never inflate event heat',()=>{const now=Date.now();assert.equal(eventHeat([{source_id:'a',published:now},{source_id:'a',published:now}],now),1);assert.equal(eventHeat([{source_id:'a',published:now},{source_id:'b',published:now-86400000}],now),1.5);assert.equal(eventHeat([{source_id:'a',published:now,archived:1}],now),0)});
test('old content and morning report use actual publish time in Beijing',()=>{const now=Date.now();assert.equal(archiveItem(now-49*3600000,now),true);const w=reportWindow('2026-09-30');assert.equal(new Date(w.end).toISOString(),'2026-09-30T00:00:00.000Z');assert.equal(w.end-w.start,86400000)});
test('the pipeline publishes only after prefilter, independent scores and summary',async()=>{const e=environment([{label:'PASS'},{attentionScore:60},{attentionScore:64},{itemType:'model_release',tags:['模型发布','推理'],titleZh:'用于测试的模型发布',summaryZh:'这是本地测试资料的摘要。',editorialJudgment:'这段资料说明了模型的开放入口。'}]);const row=await addItem(e.db);for(let n=0;n<5;n++){await consume(e.env,{kind:'item',id:row.id});const publicData=await(await get(e.env,'/items')).json();if(n<4)assert.equal(publicData.items.length,0)}assert.equal(e.prompts.length,4);assert.equal(e.prompts[1],e.prompts[2]);const data=await(await get(e.env,'/items?view=selected')).json();assert.equal(data.items.length,1);assert.equal(data.items[0].selected,1);assert.equal(data.items[0].body,undefined);await consume(e.env,{kind:'item',id:row.id});assert.equal(e.prompts.length,4)});
test('budget is reserved atomically and exhausted budget makes no model call',async()=>{const e=environment([{label:'PASS'}]);const row=await addItem(e.db);e.env.DAILY_NEURON_BUDGET='1';await consume(e.env,{kind:'item',id:row.id});assert.equal(e.prompts.length,0);assert.equal((await e.db.prepare('SELECT stage FROM items').first()).stage,'prefilter');assert.equal((await e.db.prepare('SELECT reserved FROM budgets').first()).reserved,0);assert.ok(neuronReservation('中文摘要',100)>1)});
test('Cloudflare quota failure blocks further calls for that UTC day',async()=>{const e=environment([Error('Workers AI neurons quota exceeded')]);const row=await addItem(e.db);await consume(e.env,{kind:'item',id:row.id});assert.equal(e.prompts.length,1);await consume(e.env,{kind:'item',id:row.id});assert.equal(e.prompts.length,1);assert.equal((await e.db.prepare('SELECT blocked FROM budgets').first()).blocked,1)});
test('completed receipts are reused after a stage write fails',async()=>{const e=environment([{label:'PASS'}]);const row=await addItem(e.db);await consume(e.env,{kind:'item',id:row.id});await e.db.prepare("UPDATE items SET stage='prefilter'").run();await consume(e.env,{kind:'item',id:row.id});assert.equal(e.prompts.length,1)});
test('UNKNOWN stays pending for review and never becomes public',async()=>{const e=environment([{label:'UNKNOWN'}]);const row=await addItem(e.db);await consume(e.env,{kind:'item',id:row.id});assert.equal((await e.db.prepare('SELECT stage FROM items').first()).stage,'unknown');assert.equal((await(await get(e.env,'/items')).json()).items.length,0)});
test('disabled AI and an unverified free plan never invoke the model',async()=>{for(const key of ['MODEL_CALLS_ENABLED','FREE_PLAN_VERIFIED']){const e=environment([{label:'PASS'}]);const row=await addItem(e.db);e.env[key]='false';await consume(e.env,{kind:'item',id:row.id});assert.equal(e.prompts.length,0)}});
test('admin requires a configured token and public API rejects writes',async()=>{const e=environment();assert.equal((await get(e.env,'/admin')).status,401);e.env.ADMIN_TOKEN='test-only-admin-token-123456789';assert.equal((await get(e.env,'/admin',{headers:{Authorization:'Bearer wrong'}})).status,401);assert.equal((await get(e.env,'/admin',{headers:{Authorization:'Bearer '+e.env.ADMIN_TOKEN}})).status,200);assert.equal((await get(e.env,'/items',{method:'POST'})).status,405)});
test('search treats percent and underscore literally',async()=>{const e=environment();await addItem(e.db,{stage:'done'});await e.db.prepare("UPDATE items SET title_zh='AI 100% test',summary_zh='a_b'").run();assert.equal((await(await get(e.env,'/items?q=%25')).json()).items.length,1);assert.equal((await(await get(e.env,'/items?q=no%25')).json()).items.length,0)});

test('daily article cap also blocks a queued new article',async()=>{const e=environment([{label:'PASS'}]);const row=await addItem(e.db);e.env.DAILY_ARTICLE_LIMIT='0';await consume(e.env,{kind:'item',id:row.id});assert.equal(e.prompts.length,0);assert.equal((await e.db.prepare('SELECT reserved FROM budgets').first()).reserved,0)});

test('protocol recovery preserves old receipts and counts the same article once',async()=>{const e=environment([{label:'PASS'}]);const row=await addItem(e.db,{stage:'failed'});const oldId=row.id+':prefilter';const day=new Date().toISOString().slice(0,10);await e.db.prepare("INSERT INTO receipts(id,day,reserved,state,result,error) VALUES(?,?,7,'error',?,?)").bind(oldId,day,JSON.stringify({response:'invalid completion'}),'invalid JSON').run();await e.db.prepare('INSERT INTO budgets(day,reserved) VALUES(?,7)').bind(day).run();e.db.sqlite.exec(readFileSync(new URL('../migrations/0002_chat_protocol_recovery.sql',import.meta.url),'utf8'));e.env.DAILY_ARTICLE_LIMIT='1';await consume(e.env,{kind:'item',id:row.id});assert.equal((await e.db.prepare('SELECT stage FROM items').first()).stage,'score1');assert.equal(e.prompts.length,1);assert.equal((await e.db.prepare('SELECT result FROM receipts WHERE id=?').bind(oldId).first()).result,JSON.stringify({response:'invalid completion'}));assert.ok((await e.db.prepare('SELECT reserved FROM budgets').first()).reserved>7);await e.db.prepare("UPDATE items SET stage='prefilter'").run();await consume(e.env,{kind:'item',id:row.id});assert.equal(e.prompts.length,1)});


test('large feeds retain complete entries and ignore closing tags inside CDATA',async()=>{const first='<item><title>Actual AI article</title><link>https://example.com/a</link><description><![CDATA[Example text </item> remains in this entry]]></description></item>';const xml='<rss><channel>'+first+'<item><title>Another</title><description>'+ 'x'.repeat(600)+'</description></item></channel></rss>';const prefix=await boundedFeed(new Response(xml),300);const entries=parseFeed(prefix);assert.equal(entries.length,1);assert.equal(entries[0].title,'Actual AI article');assert.ok(entries[0].body.includes('remains in this entry'));const eight='<rss><channel>'+first.repeat(10)+'</channel></rss>';assert.equal(parseFeed(await boundedFeed(new Response(eight))).length,8)});

test('original pool and detail reuse only completed public data, without invoking AI',async()=>{
  const e=environment();const row=await addItem(e.db,{stage:'done'});
  await e.db.prepare("UPDATE items SET title_zh='测试阅读条目',summary_zh='本地测试摘要',selected=1,tags='[\"OpenAI\",\"entity:openai\"]'").run();
  const pool=await(await get(e.env,'/site/pool')).json();assert.equal(pool.total,1);assert.equal(pool.items[0].title,'测试阅读条目');assert.equal(pool.items[0].timelineAt,new Date(row.published).toISOString());
  const detail=await(await get(e.env,'/site/items/'+row.id)).json();assert.equal(detail.readingMode,'summary-only');assert.equal(detail.body,null);assert.equal(detail.links.aihot,'/tools/ai-hot/items/'+row.id);assert.equal(e.prompts.length,0);
  const topics=await(await get(e.env,'/site/topics')).json();assert.equal(topics.topics.find(t=>t.slug==='openai').total,1);
});
test('withdrawal disappears from the original reader, RSS, topics and selected changes',async()=>{
  const e=environment();const row=await addItem(e.db,{stage:'done'});await e.db.prepare("UPDATE items SET selected=1,title_zh='本地测试',tags='[\"OpenAI\"]'").run();
  const snap=await(await get(e.env,'/v1/selected/snapshot')).json();assert.equal(snap.items.length,1);
  await e.db.prepare("UPDATE items SET visibility='withdrawn' WHERE id=?").bind(row.id).run();
  assert.equal((await get(e.env,'/site/items/'+row.id)).status,404);assert.equal((await(await get(e.env,'/site/pool')).json()).total,0);
  assert.equal((await(await get(e.env,'/site/topics')).json()).topics.find(t=>t.slug==='openai').total,0);
  assert.ok(!(await(await get(e.env,'/feed.xml')).text()).includes(row.id));
  assert.ok(!(await(await get(e.env,'/feed/all.xml')).text()).includes(row.id));
  const changes=await(await get(e.env,'/v1/selected/changes?cursor='+encodeURIComponent(snap.cursor))).json();assert.deepEqual(changes.changes.map(c=>[c.op,c.id]),[['remove',row.id]]);
});
test('selected snapshot keeps its watermark across pages and reports subsequent edits',async()=>{
  const e=environment();const row=await addItem(e.db,{stage:'done'});await e.db.prepare("UPDATE items SET selected=1,title_zh='首次标题'").run();
  const snap=await(await get(e.env,'/v1/selected/snapshot?fields=minimal')).json();assert.equal(snap.items[0].title,'首次标题');assert.equal(snap.items[0].summary,undefined);
  await e.db.prepare("UPDATE items SET title_zh='修订标题',revision=revision+1").run();
  const changes=await(await get(e.env,'/v1/selected/changes?cursor='+encodeURIComponent(snap.cursor))).json();assert.equal(changes.changes[0].item.title,'修订标题');assert.equal(changes.fields,'minimal');
  assert.equal((await get(e.env,'/v1/selected/changes?cursor=bad')).status,400);
});
test('original timeline filters first-party, categories and exact tags',async()=>{
  const e=environment();await addItem(e.db,{stage:'done'});await e.db.prepare("UPDATE items SET selected=1,category='ai-models',tags='[\"推理\"]'").run();
  assert.equal((await(await get(e.env,'/site/timeline?channel=firstParty')).json()).cards.length,0);
  await e.db.prepare('UPDATE sources SET first_party=1').run();
  assert.equal((await(await get(e.env,'/site/timeline?channel=firstParty&category=ai-models&tag='+encodeURIComponent('推理'))).json()).cards.length,1);
  assert.equal((await(await get(e.env,'/site/timeline?tag='+encodeURIComponent('理'))).json()).cards.length,0);
});
test('period report and empty original report page remain valid without fabricated editions',async()=>{
  const e=environment();const data=await(await get(e.env,'/site/reports/daily/latest-page')).json();assert.deepEqual(data,{index:[],report:null});
  assert.equal((await get(e.env,'/site/reports/daily/2026-09-30')).status,404);assert.equal(e.prompts.length,0);
});
test('MCP lists the five original read-only tools and validates arguments',async()=>{
  const e=environment();
  const rpc=async(body)=>{const res=await get(e.env,'/mcp',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream'},body:JSON.stringify(body)});const text=await res.text();return text.startsWith('event:')||text.startsWith('data:')?JSON.parse(text.match(/data: (.*)/)[1]):JSON.parse(text);};
  const init=await rpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'local-test',version:'1'}}});assert.equal(init.result.serverInfo.name,'softcloud');
  const list=await rpc({jsonrpc:'2.0',id:2,method:'tools/list'});assert.equal(list.result.tools.length,5);assert.ok(list.result.tools.every(t=>t.annotations.readOnlyHint));
  const call=await rpc({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'softcloud_get_latest',arguments:{limit:31}}});assert.ok(call.error||call.result.isError);assert.equal(e.prompts.length,0);
});
test('admin login creates a private expiring session and rejects changes without CSRF',async()=>{
  const e=environment();e.env.ADMIN_PASSWORD='local-test-only-password';
  const login=await get(e.env,'/auth/password',{method:'POST',headers:{Origin:'https://zoci.pro','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password:e.env.ADMIN_PASSWORD,return:'/admin/models'})});assert.equal(login.status,303);assert.equal(login.headers.get('Location'),'/tools/ai-hot/admin/models');
  const cookie=login.headers.get('Set-Cookie');assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('SameSite=Strict'));assert.ok(cookie.includes('Secure'));
  const me=await(await get(e.env,'/admin/me',{headers:{Cookie:cookie}})).json();assert.ok(me.csrf);
  const denied=await get(e.env,'/admin/models/prefilter',{method:'POST',headers:{Cookie:cookie,Origin:'https://zoci.pro','Content-Type':'application/json','Idempotency-Key':'local-model-test'},body:JSON.stringify({model:'@cf/zai-org/glm-4.7-flash'})});assert.equal(denied.status,403);
  const saved=await get(e.env,'/admin/models/prefilter',{method:'POST',headers:{Cookie:cookie,Origin:'https://zoci.pro','Content-Type':'application/json','Idempotency-Key':'local-model-test','x-csrf-token':me.csrf},body:JSON.stringify({model:'@cf/zai-org/glm-4.7-flash',reason:'local-only test'})});assert.equal(saved.status,200);
  const models=await(await get(e.env,'/admin/models',{headers:{Cookie:cookie}})).json();assert.equal(models.capabilities.find(c=>c.key==='prefilter').current.model,'@cf/zai-org/glm-4.7-flash');assert.equal(e.prompts.length,0);
});

const adminHeaders=env=>({Authorization:'Bearer '+env.ADMIN_TOKEN,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()});
const command=(e,path,data,method='POST')=>get(e.env,path,{method,headers:adminHeaders(e.env),body:JSON.stringify(data)});
test('admin operational pages read real D1 state and nested source patches enforce versions',async()=>{
 const e=environment();e.env.ADMIN_TOKEN='test-only-admin-token-123456789';const item=await addItem(e.db,{stage:'done'});
 for(const path of ['/admin/sources','/admin/sources/source','/admin/content?q='+item.id,'/admin/content/'+item.id,'/admin/runs','/admin/models','/admin/selectbench','/admin/settings','/admin/audit','/admin/feedback'])assert.equal((await get(e.env,path,{headers:adminHeaders(e.env)})).status,200,path);
 const source=(await(await get(e.env,'/admin/sources/source',{headers:adminHeaders(e.env)})).json()).source;
 const patch={patch:{name:'Renamed source',enabled:false,tier:'T1_5'},version:source.updated_at,reason:'test'};
 assert.equal((await command(e,'/admin/sources/source',patch,'PATCH')).status,200);
 assert.equal((await e.db.prepare('SELECT name,enabled,tier FROM sources').first()).enabled,0);
 assert.equal((await command(e,'/admin/sources/source',patch,'PATCH')).status,409);
 assert.equal(e.prompts.length,0);
});
test('manual content corrections update all exports and replay the same command once',async()=>{
 const e=environment();e.env.ADMIN_TOKEN='test-only-admin-token-123456789';const item=await addItem(e.db,{stage:'done'});await e.db.prepare("UPDATE items SET title_zh='旧标题',summary_zh='测试摘要',reason='测试理由',selected=1").run();
 const options={method:'POST',headers:adminHeaders(e.env),body:JSON.stringify({fields:{title:'更正标题'},version:0,reason:'test'})};
 assert.equal((await get(e.env,'/admin/content/'+item.id+'/override',options)).status,200);
 assert.equal((await get(e.env,'/admin/content/'+item.id+'/override',options)).status,200);
 assert.equal((await e.db.prepare('SELECT revision FROM items').first()).revision,2);
 assert.equal((await(await get(e.env,'/site/items/'+item.id)).json()).title,'更正标题');
 assert.equal((await command(e,'/admin/content/'+item.id+'/visibility',{visibility:'withdrawn',version:1})).status,200);
 assert.equal((await get(e.env,'/site/items/'+item.id)).status,404);
 assert.equal((await(await get(e.env,'/site/items/availability?ids='+item.id)).json())[item.id],'gone');
 const cursor='sc1.'+Buffer.from(JSON.stringify({k:'sync',w:0,f:'default'})).toString('base64url');
 const changes=await(await get(e.env,'/v1/selected/changes?cursor='+cursor)).json();assert.ok(changes.changes.every(c=>c.op==='remove'));assert.equal(e.prompts.length,0);
});
async function groupFixture(e,relation) {
 const root=await addItem(e.db,{stage:'done'}),next='abcdef0123456789abcdef01';
 await e.db.prepare("UPDATE items SET title_zh='测试模型 Aurora 发布',summary_zh='Aurora 模型发布了开放 API',selected=1,event_id=?").bind(root.id).run();
 await e.db.prepare('INSERT INTO stories(id,title,root_fact_id,created) VALUES(?,?,?,?)').bind(root.id,'Aurora发布',root.id,Date.now()).run();
 await e.db.prepare('INSERT INTO events(id,title,category,created,story_id) VALUES(?,?,?,?,?)').bind(root.id,'Aurora发布','ai-models',Date.now(),root.id).run();
 await e.db.prepare("INSERT INTO sources(id,name,url,tier) VALUES('second','Second source','https://second.example/feed','T2')").run();
 await e.db.prepare("INSERT INTO items(id,source_id,url,title,title_zh,summary_zh,published,discovered,stage,selected) VALUES(?,'second',?,'Aurora model release','测试模型 Aurora 发布','Aurora 模型发布了开放 API',?,?,'cluster',1)").bind(next,'https://second.example/'+next,Date.now(),Date.now()).run();
 await consume(e.env,{kind:'item',id:next});return{root,next};
}
test('upstream batch relation and independent pair review collapse reports while preserving heat participants',async()=>{
 const e=environment([{query:'Aurora发布',decisions:[{id:'C1',relation:'SAME_OCCURRENCE',confidence:.8,note:'同一发布'}]},{a:'Aurora',b:'Aurora',relation:'SAME_OCCURRENCE',difference:'不同来源',confidence:.75}]);
 const {root,next}=await groupFixture(e);
 assert.equal((await e.db.prepare('SELECT event_id FROM items WHERE id=?').bind(next).first()).event_id,root.id);
 const feed=await(await get(e.env,'/site/timeline')).json();assert.equal(feed.cards.length,1);assert.equal(feed.cards[0].group.reportCount,2);
 const hot=await(await get(e.env,'/site/hot')).json();assert.equal(hot.entries.length,1);assert.equal(hot.entries[0].participantCount,2);assert.ok(hot.entries[0].heat>10);assert.equal(hot.ruleVersion,'heat-v1-48h-halflife24h');
 const receipts=await e.db.prepare('SELECT purpose,model FROM receipts ORDER BY purpose').all();assert.ok(receipts.results.some(r=>r.purpose==='groupReview'&&r.model.includes('llama')));assert.equal(e.prompts.length,2);
});
test('a direct development gets a separate fact in the same story and single-source events do not enter hot',async()=>{
 const e=environment([{query:'Aurora 后续',decisions:[{id:'C1',relation:'SAME_STORY',confidence:.8,note:'直接进展'}]}]);const{root,next}=await groupFixture(e);
 assert.equal((await e.db.prepare('SELECT event_id FROM items WHERE id=?').bind(next).first()).event_id,next);
 const story=await(await get(e.env,'/site/stories/'+root.id)).json();assert.equal(story.developments.length,2);
 const followups=await(await get(e.env,'/site/stories/'+root.id+'/followups')).json();assert.equal(followups.items[0].representative.source.name,'Second source');
 await e.db.prepare("UPDATE items SET visibility='withdrawn' WHERE id=?").bind(next).run();assert.equal((await(await get(e.env,'/site/hot')).json()).entries.length,0);
});
test('period editions store real boundaries and only cite in-range numbered evidence',async()=>{
 const e=environment([{headline:'测试期刊',overview:'本地测试期刊概述',themes:[{heading:'测试主题',summary:'测试资料的主题摘要',refs:[1,99]}]}]);const row=await addItem(e.db,{stage:'done',published:Date.parse('2026-08-12T00:00:00Z')});await e.db.prepare("UPDATE items SET selected=1,summary_zh='本地期刊测试资料',title_zh='测试发布'").run();
 await consume(e.env,{kind:'period',period:'monthly',key:'2026-08'});
 const report=await(await get(e.env,'/site/reports/monthly/2026-08')).json();assert.equal(report.windowStart,'2026-07-31T16:00:00.000Z');assert.equal(report.windowEnd,'2026-08-31T16:00:00.000Z');assert.equal(report.sections[0].items.length,1);assert.equal(report.sections[0].items[0].itemId,row.id);assert.equal(e.prompts.length,1);
 await consume(e.env,{kind:'period',period:'monthly',key:'2026-08'});assert.equal(e.prompts.length,1);
});
test('feedback is bounded, privately reviewable, bannable and erasable without outbound notifications',async()=>{
 const e=environment();e.env.ADMIN_TOKEN='test-only-admin-token-123456789';const form=()=>{const f=new FormData();f.set('content','本地反馈功能测试');f.set('email','test@example.com');f.set('pageUrl','https://zoci.pro/tools/ai-hot/all');return f;};
 const submit=()=>get(e.env,'/site/feedback',{method:'POST',headers:{Origin:'https://zoci.pro','CF-Connecting-IP':'192.0.2.11'},body:form()});
 const result=await(await submit()).json();assert.ok(result.id,JSON.stringify(result));
 assert.equal((await get(e.env,'/admin/feedback')).status,401);
 const list=await(await get(e.env,'/admin/feedback',{headers:adminHeaders(e.env)})).json();assert.equal(list.rows[0].content,'本地反馈功能测试');assert.equal(list.rows[0].forwarded_at,null);
 assert.equal((await command(e,'/admin/feedback-bans',{sourceHash:list.rows[0].source_hash,reason:'test'})).status,200);assert.equal((await submit()).status,429);
 assert.equal((await command(e,'/admin/feedback/'+result.id+'/erase',{reason:'test'})).status,200);assert.equal((await e.db.prepare('SELECT count(*) n FROM feedback').first()).n,0);assert.equal(e.prompts.length,0);
});
test('model budget edits actually pause calls and public REST supports anonymous CORS',async()=>{
 const e=environment([{label:'PASS'}]);e.env.ADMIN_TOKEN='test-only-admin-token-123456789';const row=await addItem(e.db);
 assert.equal((await command(e,'/admin/budgets/'+encodeURIComponent('Workers AI (Neurons)'),{perMinute:0,perHour:6000,perDay:6000},'PUT')).status,200);
 await consume(e.env,{kind:'item',id:row.id});assert.equal(e.prompts.length,0);
 const api=await get(e.env,'/v1/items');assert.equal(api.headers.get('Access-Control-Allow-Origin'),'*');assert.equal((await get(e.env,'/v1/items',{method:'OPTIONS'})).status,204);
 const spec=await(await get(e.env,'/openapi-v1.json')).json();assert.ok(spec.paths['/api/ai-hot/v1/items']);assert.ok(!Object.keys(spec.paths).some(p=>p.includes('codex')));
});

test('concurrent claims invoke the paid provider only for the receipt owner',async()=>{
 const e=environment([{label:'PASS'}]);const item=await addItem(e.db);
 // D1 batches serialize transactions; both requests may already have read a missing receipt.
 const original=e.db.batch.bind(e.db);let last=Promise.resolve();e.db.batch=statements=>{const next=last.then(()=>original(statements));last=next.catch(()=>{});return next;};
 const consumeNoAssert=()=>worker.queue({messages:[{body:{kind:'item',id:item.id},attempts:1,ack(){},retry(){}}]},e.env);
 await Promise.all([consumeNoAssert(),consumeNoAssert()]);assert.equal(e.prompts.length,1);assert.equal((await e.db.prepare('SELECT count(*) n FROM budget_calls').first()).n,1);
});
