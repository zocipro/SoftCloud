import {query,one} from './publication.ts';
import {BatchSchema,PairSchema,batchUser,pairUser,verdictsByFact,sameOccurrence,storyForDevelopment,lexicalSimilarity,reportText,type CandidateView,type ReportView} from './relate.ts';
import {promptText} from './prompts.ts';
type GroupRow={id:string;event_id:string;story_id:string;root_fact_id:string;fact_title:string;title:string;title_zh:string|null;summary_zh:string|null;published:number;source_name:string;first_party:number};
type Infer=(id:string,instructions:string,material:unknown,maxTokens:number)=>Promise<Record<string,unknown>>;
export async function groupItem(db:D1Database,item:{id:string;title:string;title_zh:string|null;summary_zh:string|null;published:number;source_name?:string;revision?:number},infer:Infer) {
 const row=await one<{first_party:number}>(db,'SELECT s.first_party FROM sources s JOIN items i ON i.source_id=s.id WHERE i.id=?',item.id);
 const view=(r:{title:string;title_zh:string|null;summary_zh:string|null;source_name?:string;published:number;first_party?:number}):ReportView=>({title:r.title_zh??r.title,summary:r.summary_zh,source:r.source_name??'',firstParty:Boolean(r.first_party),at:new Date(r.published)});
 const incoming=view({...item,first_party:row?.first_party});
 // This is the upstream lexical recall mode for installations without embeddings.
 const pool=await query<GroupRow>(db,"SELECT i.*,s.name source_name,s.first_party,e.title fact_title,e.story_id,st.root_fact_id FROM items i JOIN sources s ON s.id=i.source_id JOIN events e ON e.id=i.event_id JOIN stories st ON st.id=e.story_id WHERE i.stage='done' AND i.visibility='public' AND i.discovered>? AND i.id<>? ORDER BY s.first_party DESC,i.published ASC LIMIT 336",Date.now()-14*86400000,item.id);
 const best=new Map<string,{candidate:CandidateView;representative:GroupRow}>();
 for(const r of pool){const similarity=lexicalSimilarity(reportText(incoming.title,incoming.summary),reportText(r.title_zh??r.title,r.summary_zh));if(similarity<.25)continue;const prev=best.get(r.event_id);if(!prev||similarity>prev.candidate.score)best.set(r.event_id,{candidate:{factId:r.event_id,storyId:r.story_id,factTitle:r.fact_title,members:pool.filter(p=>p.event_id===r.event_id).length,storyRoot:r.root_fact_id===r.event_id,score:similarity,report:view(r)},representative:r});}
 const candidates=[...best.values()].map(x=>x.candidate).sort((a,b)=>b.score-a.score).slice(0,10);
 const signature=JSON.stringify({query:incoming,candidates,revision:item.revision??1});const scope=item.id+':g'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature))),b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
 let factId=item.id,storyId=item.id;
 if(candidates.length){
   const batch=BatchSchema.parse(await infer(scope+':cluster-batch-v2',promptText('group-batch'),batchUser(incoming,candidates),Math.min(1200,200+90*candidates.length)));
   const verdicts=verdictsByFact(batch.decisions,candidates);
   for(const candidate of sameOccurrence(candidates,verdicts)){
     // Lexical recall is always independently confirmed; no invented .95 threshold.
     const review=PairSchema.parse(await infer(scope+':cluster-review-v2:'+candidate.factId,promptText('group-pair'),pairUser(incoming,candidate.report),700));
     if(review.relation==='SAME_OCCURRENCE'){factId=candidate.factId;storyId=candidate.storyId;break;}
     if(review.relation==='SAME_STORY'&&candidate.storyRoot){storyId=candidate.storyId;break;}
   }
   if(storyId===item.id){const development=storyForDevelopment(candidates,verdicts);if(development)storyId=development.storyId;}
 }
 await db.batch([
  db.prepare('INSERT OR IGNORE INTO stories(id,title,root_fact_id,created) VALUES(?,?,?,?)').bind(storyId,item.title_zh??item.title,factId,Date.now()),
  db.prepare('INSERT OR IGNORE INTO events(id,title,category,created,story_id) SELECT ?,?,category,?,? FROM items WHERE id=?').bind(factId,item.title_zh??item.title,Date.now(),storyId,item.id),
  db.prepare('UPDATE items SET event_id=?,group_pending=0,group_next_attempt=0 WHERE id=?').bind(factId,item.id)
 ]);
}
