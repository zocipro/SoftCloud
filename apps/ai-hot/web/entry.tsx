import {createElement,useEffect,type ComponentType} from 'react';
import {createRoot} from 'react-dom/client';
import {createBrowserRouter,RouterProvider,useLoaderData,useParams,useMatches,useLocation,ScrollRestoration,type LoaderFunctionArgs,type RouteObject,type MetaDescriptor} from 'react-router';
import App,{loader as rootLoader,ErrorBoundary} from './app/root';
import manifest from './manifest.json';

interface Entry {index?:boolean;path?:string;id:string;module:string;children?:Entry[]}
interface PageModule {
  default:ComponentType<{loaderData:unknown;params:Record<string,string|undefined>}>;
  ErrorBoundary?:ComponentType;
  loader?:(args:LoaderFunctionArgs)=>unknown;
  meta?:(args:{loaderData:unknown;params:Record<string,string|undefined>;location:ReturnType<typeof useLocation>;matches:ReturnType<typeof useMatches>})=>MetaDescriptor[];
}
const modules=import.meta.glob<PageModule>('./app/routes/**/*.tsx');
function route(entry:Entry):RouteObject {
  return {index:entry.index,path:entry.path,id:entry.id,lazy:async()=>{
    const page=await modules['./app/'+entry.module]();
    function Component(){
      const loaderData=useLoaderData(),params=useParams(),location=useLocation(),matches=useMatches();
      useEffect(()=>{
        if(matches.at(-1)?.id!==entry.id)return;
        const descriptors=page.meta?.({loaderData,params,location,matches})??[];
        const titled=descriptors.find(m=>'title' in m);
        document.title=titled&&'title' in titled?String(titled.title):'软云 AI 热点 · SoftCloud';
        document.head.querySelectorAll('[data-ai-hot-meta]').forEach(n=>n.remove());
        document.head.querySelectorAll('meta[name="description"],link[rel="canonical"]').forEach(n=>n.remove());
        const nodes:HTMLElement[]=[];
        for(const m of descriptors){
          let node:HTMLElement|null=null;
          if('name' in m||'property' in m){node=document.createElement('meta');if('name' in m&&m.name)node.setAttribute('name',String(m.name));if('property' in m&&m.property)node.setAttribute('property',String(m.property));node.setAttribute('content',String(m.content??''));}
          else if('tagName' in m&&m.tagName==='link'&&m.rel==='canonical'){node=document.createElement('link');node.setAttribute('rel','canonical');node.setAttribute('href',String(m.href));}
          else if('script:ld+json' in m){node=document.createElement('script');node.setAttribute('type','application/ld+json');node.textContent=JSON.stringify(m['script:ld+json']);}
          if(node){node.dataset.aiHotMeta='true';document.head.append(node);nodes.push(node);}
        }
        if(location.pathname.startsWith('/admin')){const node=document.createElement('meta');node.name='robots';node.content='noindex, nofollow';node.dataset.aiHotMeta='true';document.head.append(node);nodes.push(node);}
        return()=>nodes.forEach(n=>n.remove());
      },[location.key]);
      return createElement(page.default,{loaderData,params});
    }
    return {Component,ErrorBoundary:page.ErrorBoundary,loader:page.loader?async(args:LoaderFunctionArgs)=>{
      const u=new URL(args.request.url);u.pathname=u.pathname.replace(/^\/tools\/ai-hot/,'')||'/';
      return page.loader!({...args,request:new Request(u,args.request)});
    }:undefined};
  },children:entry.children?.map(route)} as RouteObject;
}
// Preserve links from the first version, including the user's current ?view=all URL.
const legacy=new URL(location.href);
if(legacy.pathname.replace(/\/$/,'')==='/tools/ai-hot'){
  const view=legacy.searchParams.get('view'),item=legacy.searchParams.get('item');
  if(item&&/^[a-zA-Z0-9_-]{1,80}$/.test(item)){legacy.pathname='/tools/ai-hot/items/'+item;legacy.searchParams.delete('item');}
  else if(view){const target:{[key:string]:string}={all:'all',hot:'hot',report:'daily',topics:'topics',starred:'starred',selected:''};if(view in target){legacy.pathname='/tools/ai-hot/'+target[view];legacy.searchParams.delete('view');}}
  history.replaceState(null,'',legacy);
}
try {
  if(!localStorage.getItem('softcloud-ai-hot-starred-v2')) {
    const old=JSON.parse(localStorage.getItem('softcloud-ai-hot-stars')||'{}');
    if(old&&typeof old==='object'&&!Array.isArray(old)) {
      const rows=Object.values(old).filter((r):r is Record<string,unknown>=>!!r&&typeof r==='object'&&typeof (r as Record<string,unknown>).id==='string');
      if(rows.length)localStorage.setItem('softcloud-ai-hot-starred-v2',JSON.stringify(rows.map(r=>({id:r.id,title:r.title_zh||r.title,summary:r.summary_zh||null,sourceName:r.source_name||'',savedAt:new Date().toISOString(),publishedAt:typeof r.published==='number'?new Date(r.published).toISOString():null,score:typeof r.score1==='number'&&typeof r.score2==='number'?(r.score1+r.score2)/2:null,aiSelected:!!r.selected}))));
    }
  }
}catch{}
const router=createBrowserRouter([{id:'root',HydrateFallback:()=>createElement('div',{className:'p-6 text-ink'},'正在载入软云 AI 热点…'),Component:()=>createElement('div',null,createElement(App),createElement(ScrollRestoration)),ErrorBoundary,loader:(args)=>rootLoader({...args,params:{}}),children:manifest.map(route)}],{basename:'/tools/ai-hot'});
createRoot(document.getElementById('root')!).render(createElement(RouterProvider,{router}));
