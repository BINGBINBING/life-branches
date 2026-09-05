import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {curatedArchive} from './archive-annotations.mjs';

// Public preview exposes only the built UI and a fixed, non-personal archive.
// It deliberately has no connection to the credential-bearing CLI service.
let saved;
try { saved = JSON.parse(await readFile(new URL('../.local/archive.json', import.meta.url), 'utf8')); }
catch { saved = curatedArchive(); }
const archive = {...saved,id:'public-historical-example',historical:true,createdAt:Date.now()};
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};

const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/branches/health' && req.method==='GET') return json(res,200,{ok:true,mode:'preview',archive:true,quota:[{APIID:'zhihu_search',RemainingQuota:0}]});
    if(url.pathname==='/api/branches/archive' && req.method==='POST') return json(res,200,archive);
    if(url.pathname==='/api/branches/jobs/'+archive.id && req.method==='GET') return json(res,200,archive);
    if(url.pathname.startsWith('/api/')) return json(res,403,{error:'此链接用于临时展示已有真实样本，未开放实时搜索或重新分析。请返回查看历史样本。'});
    const allowed=url.pathname==='/' || url.pathname==='/favicon.ico' || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/_next/');
    if(!allowed || !['GET','HEAD'].includes(req.method)) return json(res,404,{error:'未找到页面。'});
    const headers={};
    for(const key of ['accept','rsc','next-router-state-tree','next-router-prefetch','content-type']) if(req.headers[key]) headers[key]=req.headers[key];
    const upstream=await fetch('http://127.0.0.1:4317'+url.pathname+url.search,{method:req.method,headers,redirect:'manual',signal:AbortSignal.timeout(25000)});
    res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD') return res.end();
    if(upstream.body) for await(const chunk of upstream.body) res.write(chunk);
    res.end();
  } catch { if(!res.headersSent) json(res,502,{error:'展示服务暂时不可用。'});else res.end(); }
});
server.requestTimeout=30000;
server.listen(4320,'127.0.0.1',()=>console.log('Share preview: http://127.0.0.1:4320'));
