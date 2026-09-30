import { one } from './publication.ts';
// Only models currently available without paid billing are exposed to the free site.
export const MODELS = [
  {key:'@cf/qwen/qwen3-30b-a3b-fp8',input:4625,output:30475},
  {key:'@cf/meta/llama-3.3-70b-instruct-fp8-fast',input:26668,output:204805},
  {key:'@cf/zai-org/glm-4.7-flash',input:5500,output:36400},
] as const;
export const CAPABILITIES=[
  {key:'prefilter',label:'预筛',env:'PREFILTER_MODEL'},
  {key:'selection',label:'两次独立评分',env:'SELECTION_MODEL'},
  {key:'understand',label:'内容理解与中文摘要',env:'UNDERSTAND_MODEL'},
  {key:'group',label:'事件归组',env:'GROUP_MODEL'},
  {key:'groupReview',label:'归组复核',env:'GROUP_REVIEW_MODEL'},
  {key:'report',label:'日报与周期报告',env:'REPORT_MODEL'},
] as const;
export function capability(id:string){if(id.startsWith('report:')||id.startsWith('period:'))return 'report';if(id.endsWith(':prefilter'))return 'prefilter';if(/:score[12]$/.test(id))return 'selection';if(id.includes(':cluster-review'))return 'groupReview';if(id.includes(':cluster'))return 'group';return 'understand';}
export async function configuredModel(db:D1Database,purpose:string) {
  const value=await one<{value:string}>(db,'SELECT value FROM settings WHERE key=?','model:'+purpose);
  const fallback=purpose==='groupReview'?'@cf/meta/llama-3.3-70b-instruct-fp8-fast':MODELS[0].key;
  const model=MODELS.find(m=>m.key===value?.value)??MODELS.find(m=>m.key===fallback)!;
  return {...model,source:value?'admin' as const:'default' as const};
}
export function reservation(prompt:string,maxTokens:number,model:{input:number;output:number}) {return Math.ceil((new TextEncoder().encode(prompt).length+1024)*model.input/1e6+maxTokens*model.output/1e6);}

export async function budgetConfig(db:D1Database,maximum=6000) {
 const stored=await one<{value:string}>(db,"SELECT value FROM settings WHERE key='neuron_budget'");
 const hard=Math.min(6000,Math.max(0,maximum));
 const config=stored?JSON.parse(stored.value):{perMinute:hard,perHour:hard,perDay:hard,updated:0};
 return {perMinute:Math.min(hard,Math.max(0,Number(config.perMinute)||0)),perHour:Math.min(hard,Math.max(0,Number(config.perHour)||0)),perDay:Math.min(hard,Math.max(0,Number(config.perDay)||0)),updated:config.updated||0};
}
