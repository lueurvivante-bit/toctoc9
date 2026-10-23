import assert from 'node:assert/strict';
import {createRuntime} from '../src/engine.gen.js';
import {Store,serverFirebase} from '../src/store.js';
const tick=()=>new Promise(setImmediate);
const report=[];
for(let run=0;run<10;run++){
 const code='T'+String(run).padStart(3,'0'),base='games/'+code,store=new Store(()=>{});
 const players=Array.from({length:2+run%3},(_,i)=>({uid:'p'+i,name:'Test '+i,avatar:['fox','cat','bear','lion'][i]}));
 const cfg={nPlayers:players.length,bots:0,adminPlays:true,handSize:4+run%3,peek:run%3,turnTimer:false};
 store.ref(base+'/meta').set({host:'p0',phase:'lobby',level:'normal',cfg});
 players.forEach((p,i)=>store.ref(base+'/players/'+p.uid).set({...p,joinedAt:i+1}));
 const rt=createRuntime({firebase:serverFirebase(store),setTimeout:()=>0,clearTimeout(){}});rt.attach(code,'p0');
 assert.ok(!rt.launch('p0',players,store.get(base+'/meta'),{}));await tick();
 let actions=0,peeks=0,rounds=0,restarted=false;
 for(let step=0;step<8000;step++){
  const s=store.get(base+'/state');assert.ok(s,'state lost');
  if(s.phase==='peek'){
   const previous=s.peekId;assert.ok(previous);peeks++;
   for(const p of players)if(s.order.includes(p.uid))store.ref(base+'/state/peekDone/'+p.uid).set(true);
   await tick();assert.equal(store.get(base+'/state/phase'),'turn','memorization blocked');continue;
  }
  if(s.phase==='over'){
   if(restarted)break;
   rt.action({type:'restart',by:'p0',ts:Date.now()});await tick();
   assert.equal(store.get(base+'/state/phase'),'peek','restart blocked');restarted=true;continue;
  }
  if(s.phase==='reveal'){rounds++;rt.action({type:'newround',by:'p0',ts:Date.now()});await tick();assert.equal(store.get(base+'/state/phase'),'peek','new round blocked');continue;}
  assert.equal(s.phase,'turn');
  const actor=s.pendingFigure?.by||s.order[s.turnIndex];let type;
  if(s.pendingFigure)type=s.pendingFigure.step==='shown'?'fig_done':'fig_skip';
  else if(store.get(base+'/private/'+actor+'/drawn'))type='discard';
  else if(!s.knocked&&s.turnNumber>=3*s.order.length)type='toc';else type='draw';
  rt.action({type,by:actor,ts:Date.now()});actions++;await tick();
  if(type==='draw')assert.ok(store.get(base+'/private/'+actor+'/drawn'),'draw blocked');
  if(restarted&&actions>100&&store.get(base+'/state/phase')==='over')break;
 }
 assert.ok(restarted,'game never completed');assert.equal(store.get(base+'/state/phase'),'over','second game stalled');
 report.push({run:run+1,players:players.length,cards:cfg.handSize,quota:cfg.peek,actions,peeks,rounds,restarted});
}
console.log(JSON.stringify(report,null,2));
console.log('10 simulations, chacune terminée puis rejouée jusqu’à la fin : OK');
