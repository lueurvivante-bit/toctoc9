// Joueur humain absent : jamais joué par un bot ; sans chrono la partie attend,
// avec chrono son tour passe ; mémorisation attendue ou validée au chrono ;
// rôle d'organisateur rendu au créateur ; siège de l'arbitre stable.
import assert from 'node:assert/strict';
import {createRuntime} from '../src/engine.gen.js';
import {Store,serverFirebase} from '../src/store.js';
import {electHost} from '../src/host.js';
const tick=()=>new Promise(setImmediate);
let n=0;
async function room({turnTimer,adminPlays=true,creator='h',by='h'}){
 const code='A'+String(++n).padStart(3,'0'),base='games/'+code,store=new Store(()=>{}),timers=[];
 const host={setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:id=>{if(timers[id-1])timers[id-1].dead=true;}};
 const rt=createRuntime({firebase:serverFirebase(store),...host});
 const cfg={nPlayers:adminPlays?2:2,bots:0,adminPlays,handSize:4,peek:0,turnTimer,turnSecs:5};
 const players=[{uid:'h',name:'Un',avatar:'fox'},{uid:'p',name:'Deux',avatar:'cat'}];
 if(!adminPlays)players.push({uid:'q',name:'Trois',avatar:'owl'});
 store.ref(base+'/meta').set({host:by,creator,phase:'lobby',level:'normal',cfg});
 players.forEach((p,i)=>store.ref(base+'/players/'+p.uid).set({...p,joinedAt:i+1}));
 rt.attach(code,by);
 assert.equal(rt.launch(by,players,store.get(base+'/meta'),{}),null);await tick();
 const s=()=>store.get(base+'/state');
 const fire=async ms=>{for(const t of timers)if(!t.dead&&t.ms===ms){t.dead=true;t.fn();}await tick();};
 return {rt,store,base,s,fire,timers};
}
const away=(...live)=>{const now=Date.now(),seen={h:now-20000,p:now-20000,q:now-20000};live.forEach(u=>seen[u]=now);return seen;};

// Absence indépendante du chrono : affichage immédiat, grâce 10 s, aucun bot.
for(const turnTimer of [false,true]){
 const r=await room({turnTimer});
 r.store.ref(r.base+'/state/peekDone/p').set(true);await tick();
 const start=Date.now();r.rt.presenceTick(away('p'),{h:start});await tick();
 assert.equal(r.s().absent.h.deadline,start+10000,'délai serveur incorrect');
 r.rt.presenceTick(away('p'),{h:start-11000});await tick();
 assert.equal(r.s().phase,'peek','mémorisation validée à la place de l’absent');
 assert.ok(!r.s().peekDone.h);
 r.rt.presenceTick(away('h','p'),{});await tick();assert.deepEqual(r.s().absent,{});
 r.store.ref(r.base+'/state/peekDone/h').set(true);await tick();
 const cur=r.s().order[r.s().turnIndex],other=cur==='h'?'p':'h';
 const hand=JSON.stringify(r.store.get(r.base+'/hands/'+cur)),discard=JSON.stringify(r.s().discardTop),turn=r.s().turnNumber;
 r.rt.presenceTick(away(other),{[cur]:Date.now()});await tick();
 assert.equal(r.s().order[r.s().turnIndex],cur,'tour passé avant dix secondes');
 assert.ok(!r.store.get(r.base+'/private/'+cur+'/drawn'),'bot ayant pioché');
 if(turnTimer)assert.ok(!r.timers.some(t=>!t.dead&&t.ms===5300),'chrono court resté actif pendant la grâce');
 r.rt.presenceTick(away(other),{[cur]:Date.now()-11000});await tick();
 assert.equal(r.s().order[r.s().turnIndex],other,'tour non passé après dix secondes');
 assert.equal(r.s().turnNumber,turn+1);assert.equal(r.s().move.type,'skip');
 assert.equal(JSON.stringify(r.store.get(r.base+'/hands/'+cur)),hand,'main modifiée pendant absence');
 assert.equal(JSON.stringify(r.s().discardTop),discard,'carte jouée pour l’absent');
 r.rt.presenceTick(away('h','p'),{});await tick();assert.deepEqual(r.s().absent,{});
 // Reprise : le joueur présent termine son tour, le joueur revenu peut piocher.
 r.rt.action({type:'draw',by:other});await tick();r.rt.action({type:'discard',by:other});await tick();
 if(r.s().pendingFigure){r.rt.action({type:'fig_skip',by:other});await tick();}
 assert.equal(r.s().order[r.s().turnIndex],cur);
 r.rt.action({type:'draw',by:cur});await tick();assert.ok(r.store.get(r.base+'/private/'+cur+'/drawn'),'reprise impossible');
}
console.log('Avec/sans chrono : absence immédiate, grâce dix secondes, tour passé sans bot, mémorisation préservée, retour jouable OK');

// 3. Organisateur : remplacé pendant l’absence, rendu au créateur à son retour.
{
 const now=Date.now(),players={h:{},p:{},q:{}},meta={host:'h',creator:'h'};
 assert.equal(electHost(meta,players,{h:now-11000,p:now,q:now},now,now-60000),'p');
 assert.equal(electHost(meta,players,{h:now-5000,p:now},now,now-60000),null,'remplacé trop tôt');
 assert.equal(electHost({host:'p',creator:'h'},players,{h:now,p:now},now,now-60000),'h','rôle non rendu au créateur');
 assert.equal(electHost({host:'p',creator:'h'},{p:{},q:{}},{h:now,p:now},now,now-60000),null,'rendu à un créateur qui a quitté');
 assert.equal(electHost({host:'p',creator:'h'},players,{h:now-20000,p:now},now,now-60000),null);
 assert.equal(electHost({host:'h'},players,{h:now,p:now},now,now-60000),null,'ancienne salle sans créateur');
}
// 4. Siège : l’ordre de jeu suit le créateur, pas l’organisateur du moment.
{
 const obs=await room({turnTimer:false,adminPlays:false,by:'p'});
 assert.deepEqual([...obs.s().order].sort(),['p','q'],'J’observe : le créateur a reçu une main ou un joueur a été exclu');
 const pl=await room({turnTimer:false,adminPlays:true,by:'p'});
 assert.deepEqual([...pl.s().order].sort(),['h','p'],'Je joue : le créateur absent a perdu sa place');
}
console.log('Organisateur rendu au créateur ; siège arbitre/joueur stable même lancé par un remplaçant OK');
process.exit(0);
