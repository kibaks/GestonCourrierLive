import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionFetch} from '../src/services/sessionFetch.ts';
const base='https://api.example.test/backend';
function harness(handler:(url:string,auth:string|null)=>Promise<Response>,refreshHandler?:(set:(v:string|null)=>void)=>Promise<string|null>){
 let token:string|null='old';let expired=0,refreshes=0;
 const call=createSessionFetch({baseUrl:()=>base,getToken:()=>token,
  refresh:async()=>{refreshes++;return refreshHandler?refreshHandler(value=>{token=value;}):null;},
  onExpired:()=>{expired++;token=null;},
  fetcher:async(input,init)=>handler(String(input),new Headers(init?.headers).get('Authorization'))});
 return {call,get expired(){return expired},get refreshes(){return refreshes},setToken:(v:string|null)=>{token=v;}};
}
const request={headers:{Authorization:'Bearer old'}};
test('renews an expired token and retries the protected request',async()=>{
 const h=harness(async(_url,auth)=>new Response('{}',{status:auth==='Bearer new'?200:401}),async set=>{set('new');return 'new';});
 assert.equal((await h.call(base+'/api/users',request)).status,200);assert.equal(h.refreshes,1);assert.equal(h.expired,0);
});
test('concurrent failures share one renewal',async()=>{
 const h=harness(async(_url,auth)=>new Response('{}',{status:auth==='Bearer new'?200:401}),async set=>{await new Promise(resolve=>setTimeout(resolve,10));set('new');return 'new';});
 const responses=await Promise.all([h.call(base+'/api/users',request),h.call(base+'/api/roles',request)]);
 assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal(h.refreshes,1);
});
test('terminal authentication failure expires the session once',async()=>{
 const h=harness(async()=>new Response('{}',{status:401}),async()=>{await new Promise(resolve=>setTimeout(resolve,10));return null;});
 await Promise.all([h.call(base+'/api/users',request),h.call(base+'/api/roles',request)]);
 assert.equal(h.expired,1);
});
test('incorrect login credentials do not expire another session',async()=>{
 const h=harness(async()=>new Response('{}',{status:401}));
 await h.call(base+'/api/auth/login',request);assert.equal(h.refreshes,0);assert.equal(h.expired,0);
});
test('an old response does not overwrite a newer login',async()=>{
 let first=true;const h=harness(async(_url,auth)=>{if(first){first=false;h.setToken('new-login');return new Response('{}',{status:401});}assert.equal(auth,'Bearer new-login');return new Response('{}');});
 assert.equal((await h.call(base+'/api/users',request)).status,200);assert.equal(h.refreshes,0);assert.equal(h.expired,0);
});
test('a response after logout cannot restore the session',async()=>{
 const h=harness(async()=>{h.setToken(null);return new Response('{}',{status:401});});
 await h.call(base+'/api/users',request);assert.equal(h.refreshes,0);assert.equal(h.expired,0);
});
test('anonymous and external requests do not renew credentials',async()=>{
 const h=harness(async()=>new Response('{}',{status:401}));
 await h.call(base+'/api/users');await h.call('https://external.example.test/api/users',request);
 assert.equal(h.refreshes,0);assert.equal(h.expired,0);
});
test('a rejected retried token locks the session',async()=>{
 const h=harness(async()=>new Response('{}',{status:401}),async set=>{set('new');return 'new';});
 await h.call(base+'/api/users',request);assert.equal(h.expired,1);assert.equal(h.refreshes,1);
});
