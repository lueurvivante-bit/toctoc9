const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
function client(){
 let id=0;const timers=new Map(),sockets=[],memory=new Map(),classes=new Set(),notices=[],events={document:{},window:{}};
 class WS {constructor(){this.readyState=1;sockets.push(this);}send(m){this.sent??=[];this.sent.push(JSON.parse(m));}close(){this.readyState=3;this.onclose?.();}}
 const ctx={window:{addEventListener:(name,fn)=>{events.window[name]=fn;}},location:{search:'',origin:'https://test.local'},URLSearchParams,crypto:require('node:crypto').webcrypto,structuredClone,console,Date,Map,Set,Promise,queueMicrotask,WebSocket:WS,
 localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},document:{visibilityState:'visible',addEventListener:(name,fn)=>{events.document[name]=fn;},body:{classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}}},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:i=>timers.delete(i),setStatus(){},toast:m=>notices.push(m)};
 vm.runInNewContext(fs.readFileSync('public/net.js','utf8'),ctx);
 const run=ms=>{for(const [i,t]of [...timers])if(t.ms===ms){timers.delete(i);t.fn();}};
 const recv=(ws,m)=>ws.onmessage?.({data:JSON.stringify(m)});
 return {ctx,sockets,classes,notices,events,run,recv,timers,expire(){run(8000);},reconnect(){run(300);run(600);return sockets.at(-1);},
  hello(extra){const ws=sockets.at(-1);ws.onopen();recv(ws,Object.assign({t:'hello'},extra));return ws;}};
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
 // B007 : prise ouverte mais muette. L'ACK expire → la prise est abandonnée, reconnexion,
 // vue complète, aucune action rejouée, et le coup suivant passe.
 {
  const c=client(),db=c.ctx.window.firebase.database();let seen=null;
  db.ref('games/TEST/state').on('value',s=>{seen=s.val();});
  const ws1=c.hello();c.recv(ws1,{t:'view',d:{state:{phase:'turn',turn:1}},full:true});
  const swap=db.ref('games/TEST/actions/a1').set({type:'swap'}).then(()=>null,e=>e.message);
  assert.ok(ws1.sent.some(m=>m.t==='w'&&m.value.type==='swap'));
  c.expire();
  assert.ok(await swap,'swap sans ACK doit échouer');
  assert.equal(ws1.readyState,3,'prise muette non fermée');
  assert.ok(!c.classes.has('net-wait'));
  assert.equal(c.sockets.length,1,'reconnexion avant délai');
  const ws2=c.reconnect();
  assert.notEqual(ws2,ws1,'aucune nouvelle prise');
  c.hello();
  assert.deepEqual(ws2.sent.map(m=>m.t),['hello'],'action expirée rejouée automatiquement');
  c.recv(ws2,{t:'view',d:{state:{phase:'turn',turn:2}},full:true});
  await new Promise(setImmediate);assert.equal(seen?.turn,2,'vue complète non appliquée');
  c.recv(ws1,{t:'ack',id:ws1.sent.find(m=>m.t==='w').id,ok:true}); // ACK tardif de l'ancienne prise : ignoré
  const again=db.ref('games/TEST/actions/a2').set({type:'swap'}).then(()=>null,e=>e.message);
  const w2=ws2.sent.find(m=>m.t==='w');
  assert.ok(w2&&w2.value.type==='swap','coup suivant non envoyé sur la nouvelle prise');
  c.recv(ws2,{t:'ack',id:w2.id,ok:true});
  assert.equal(await again,null,'coup suivant non confirmé');
  assert.ok(c.ctx.window.tocBugJournal().some(e=>e.kind==='ack-timeout'));
 }
 // Écriture idempotente hors action (mémorisation) : gardée, renvoyée une fois sur la nouvelle prise.
 {
  const c=client(),db=c.ctx.window.firebase.database();db.ref('games/TEST/state').on('value',()=>{});
  const ws1=c.hello();c.recv(ws1,{t:'view',d:{state:{phase:'peek'}},full:true});
  const memo=db.ref('games/TEST/state/peekDone/me').set(true).then(()=>null,e=>e.message);
  const id=ws1.sent.find(m=>m.t==='w').id;
  c.expire();
  assert.equal(ws1.readyState,3,'prise muette non fermée (mémorisation)');
  const ws2=c.reconnect();c.hello();
  const resent=ws2.sent.filter(m=>m.t==='w');
  assert.equal(resent.length,1);assert.equal(resent[0].id,id);assert.equal(resent[0].path,'games/TEST/state/peekDone/me');
  c.recv(ws2,{t:'ack',id,ok:true});
  assert.equal(await memo,null,'mémorisation non confirmée après reconnexion');
  // Deuxième absence d'ACK : rejet borné, pas d'attente infinie.
  const memo2=db.ref('games/TEST/state/peekDone/me').set(true).then(()=>null,e=>e.message);
  c.expire();const ws3=c.reconnect();c.hello();c.expire();
  assert.ok(await memo2,'mémorisation bloquée indéfiniment');
  assert.ok(ws3.readyState===3);
 }
 // Vigie : serveur compatible (pong) mais plus aucun message → ping, puis prise remplacée.
 {
  const c=client();c.ctx.window.firebase.database().ref('games/TEST/state').on('value',()=>{});
  const ws1=c.hello({pong:true});
  c.run(15000);assert.deepEqual(ws1.sent.at(-1),{t:'ping'});
  c.recv(ws1,{t:'pong'});c.run(5000);assert.equal(ws1.readyState,1,'prise vivante fermée');
  c.run(15000);c.run(5000);assert.equal(ws1.readyState,3,'prise muette conservée');
  const ws2=c.reconnect();assert.notEqual(ws2,ws1);
  assert.ok(c.ctx.window.tocBugJournal().some(e=>e.kind==='silent-socket'));
  // Ancien serveur (sans pong annoncé) : pas de ping.
  const old=client();old.ctx.window.firebase.database().ref('games/TEST/state').on('value',()=>{});
  const wsOld=old.hello();old.run(15000);assert.ok(!(wsOld.sent||[]).some(m=>m.t==='ping'));
 }
 // Mise en arrière-plan : signal explicite ; retour : identité conservée et vue fraîche.
 {
  const c=client(),db=c.ctx.window.firebase.database();let turn;
  db.ref('games/TEST/state').on('value',s=>{turn=s.val()?.turn;});
  const ws=c.hello({pong:true}),identity=ws.sent[0];c.recv(ws,{t:'view',d:{state:{turn:1}}});
  c.ctx.document.visibilityState='hidden';c.events.document.visibilitychange();
  assert.equal(ws.sent.at(-1).t,'presence');assert.equal(ws.sent.at(-1).active,false);
  c.ctx.document.visibilityState='visible';c.events.document.visibilitychange();
  assert.equal(ws.readyState,3);const next=c.reconnect();c.hello({pong:true});
  assert.equal(next.sent[0].uid,identity.uid);assert.equal(next.sent[0].token,identity.token);
  assert.equal(next.sent[0].active,true);assert.equal(next.sent[0].presence,true);
  const early=await db.ref('games/TEST/actions/early').set({type:'draw'}).then(()=>null,e=>e.message);assert.match(early,/reconnecte/);assert.ok(!next.sent.some(m=>m.t==='w'));
  c.recv(next,{t:'view',d:{state:{turn:2}}});await new Promise(setImmediate);assert.equal(turn,2);
  await c.ctx.window.cloudHeartbeat('TEST');assert.equal(next.sent.at(-1).active,true);
  c.events.window.pagehide();assert.equal(next.sent.at(-1).active,false);
  c.events.window.pageshow({persisted:true});assert.equal(next.readyState,3);
 }
 // Sortie volontaire : aucune reconnexion de l'ancienne salle, même après délai déjà programmé.
 {
  const c=client(),db=c.ctx.window.firebase.database();
  db.ref('games/OLD1/state').on('value',()=>{});const old=c.hello({pong:true});
  c.recv(old,{t:'view',d:{state:{phase:'turn'}}});old.close();
  c.ctx.window.cloudReleaseRoom('OLD1');c.run(300);c.run(600);
  assert.equal(c.sockets.length,1,'ancienne salle reconnectée après sortie');
  db.ref('games/NEW1/state').on('value',()=>{});const next=c.hello({pong:true});
  c.recv(next,{t:'view',d:{state:{phase:'lobby'}}});await new Promise(setImmediate);
  assert.equal(c.sockets.length,2);assert.notEqual(next,old);
  assert.equal(next.sent[0].uid,old.sent[0].uid,'identité globale perdue entre salles');
  c.ctx.window.cloudReleaseRoom('NEW1');assert.equal(next.readyState,3);
  c.run(300);c.run(600);assert.equal(c.sockets.length,2);
 }
{
  // Veille d'une salle inactive : pas de reconnexion automatique, reprise au toucher,
  // au retour sur l'onglet ou à la première écriture.
  const c=client(),db=c.ctx.window.firebase.database();db.ref('games/TEST/state').on('value',()=>{});
  const allTimers=()=>{for(const ms of [300,600,1200,2400,3000,4800,9600,15000,8000,5000])c.run(ms);};
  const ws1=c.hello();c.recv(ws1,{t:'view',d:{state:{phase:'turn'}},full:true});
  c.recv(ws1,{t:'sleep'});
  assert.equal(ws1.readyState,3,'prise non fermée à la mise en veille');
  allTimers();assert.equal(c.sockets.length,1,'reconnexion automatique pendant la veille');
  await assert.rejects(c.ctx.window.cloudHeartbeat('TEST'),/veille/,'battement doit signaler la veille');
  c.events.window.pointerdown();assert.equal(c.sockets.length,2,'toucher ne réveille pas la salle');
  const ws2=c.hello();assert.deepEqual(ws2.sent.map(m=>m.t),['hello']);
  ws2.onclose({code:4001});allTimers();assert.equal(c.sockets.length,2,'fermeture 4001 suivie d’une reconnexion');
  c.ctx.document.visibilityState='visible';c.events.document.visibilitychange();
  assert.equal(c.sockets.length,3,'retour sur l’onglet ne réveille pas la salle');
  const ws3=c.hello();c.recv(ws3,{t:'sleep'});allTimers();assert.equal(c.sockets.length,3);
  const write=db.ref('games/TEST/players/me').update({name:'Moi'}).then(()=>null,e=>e.message);
  assert.equal(c.sockets.length,4,'une écriture ne réveille pas la salle');
  const ws4=c.hello();const w=ws4.sent.find(m=>m.t==='w');assert.ok(w,'écriture non envoyée après réveil');
  c.recv(ws4,{t:'ack',id:w.id,ok:true});assert.equal(await write,null);
  // Échecs répétés (serveur indisponible) : reconnexion espacée à 15 s au lieu de 3 s.
  const d=client();d.ctx.window.firebase.database().ref('games/TEST/state').on('value',()=>{});d.hello();const delays=[];
  for(let i=0;i<8;i++){d.sockets.at(-1).close();const t=[...d.timers.values()].at(-1);delays.push(t.ms);d.timers.clear();t.fn();}
  assert.deepEqual(delays,[300,600,1200,2400,3000,3000,15000,15000],'espacement des reconnexions');
 }
 console.log('Veille : salle inactive fermée par le serveur, aucune reconnexion automatique, reprise au toucher/onglet/écriture OK');
 console.log('Arrière-plan, battement visible, pagehide, retour/BFCache : identité et vue de partie préservées OK');
 console.log('Réseau B007 : prise muette remplacée après ACK absent, vue complète, aucune action rejouée, coup suivant confirmé ; mémorisation renvoyée une fois ; vigie ping/pong OK');
})().catch(e=>{console.error(e);process.exitCode=1});
