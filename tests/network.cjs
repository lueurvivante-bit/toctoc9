const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
function client(){
 let id=0;const timers=new Map(),sockets=[],memory=new Map(),classes=new Set(),notices=[];
 class WS {constructor(){this.readyState=1;sockets.push(this);}send(m){this.sent??=[];this.sent.push(JSON.parse(m));}close(){this.readyState=3;this.onclose?.();}}
 const ctx={window:{},location:{search:'',origin:'https://test.local'},URLSearchParams,crypto:require('node:crypto').webcrypto,structuredClone,console,Date,Map,Set,Promise,queueMicrotask,WebSocket:WS,
 localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},document:{body:{classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}}},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:i=>timers.delete(i),setStatus(){},toast:m=>notices.push(m)};
 vm.runInNewContext(fs.readFileSync('public/net.js','utf8'),ctx);
 return {ctx,sockets,classes,notices,expire(){for(const [i,t]of [...timers])if(t.ms===8000){timers.delete(i);t.fn();}},hello(){const ws=sockets.at(-1);ws.onopen();ws.onmessage({data:JSON.stringify({t:'hello'})});return ws;}};
}
(async()=>{
 for(const scenario of ['timeout','rejection','disconnect','success']){
  const c=client(),promise=c.ctx.window.firebase.database().ref('games/TEST/actions/a').set({type:'draw'});
  const outcome=promise.then(()=>null,e=>e.message);const ws=c.hello(),message=ws.sent.find(m=>m.t==='w');
  if(scenario==='timeout')c.expire();
  else if(scenario==='disconnect')ws.close();
  else ws.onmessage({data:JSON.stringify({t:'ack',id:message.id,ok:scenario==='success',error:'hors tour'})});
  const error=await outcome;
  assert.equal(Boolean(error),scenario!=='success');assert.ok(!c.classes.has('net-wait'));
  assert.equal(c.ctx.window.tocBugJournal().length>0,scenario!=='success');
  assert.ok(!JSON.stringify(c.ctx.window.tocBugJournal()).includes('TEST'),'room leaked');
 }
 const c=client();c.ctx.window.firebase.database().ref('games/TEST/state').on('value',()=>{});const ws=c.hello();
 ws.onmessage({data:JSON.stringify({t:'view',d:{meta:{phase:'lobby'}}})});
 const request=c.ctx.window.cloudReserveIdentity('TEST','ignored','Name','fox').then(()=>null,e=>e.message);
 await new Promise(setImmediate);c.expire();assert.ok(await request,'identity request stuck');
 console.log('Réseau : absence ACK, refus, déconnexion, succès et réservation sans réponse contrôlés ; journal sans code/nom/jeton OK');
})().catch(e=>{console.error(e);process.exitCode=1});
