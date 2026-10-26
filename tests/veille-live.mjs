// Test technique local : salle sans action de joueur → veille (connexions fermées, minuteurs
// arrêtés), puis reprise intacte. À lancer contre `wrangler dev --local --port 8138
// --var ROOM_IDLE_MS:15000` (délai réduit, supérieur au chrono de 5 s et à la grâce d’absence de 10 s ; 10 minutes en production).
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.env.TOCTOC_TEST_URL||'http://127.0.0.1:8138';
const IDLE=Number(process.env.ROOM_IDLE_MS||15000);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,ms=5000){const end=Date.now()+ms;while(Date.now()<end){if(fn())return;await pause(25);}throw Error('Délai : '+label);}
class Client{
 constructor(){this.uid=randomUUID();this.token=randomUUID()+randomUUID();this.seq=0;}
 async open(room,active=true){
  this.room=room;this.view={};this.messages=[];this.closed=null;
  this.ws=new WebSocket(base.replace(/^http/,'ws')+'/ws?room='+room);
  this.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);this.messages.push(m);if(m.t==='view')Object.assign(this.view,m.d);});
  this.ws.addEventListener('close',e=>{this.closed=e.code;clearInterval(this.beat);});
  await new Promise(r=>this.ws.addEventListener('open',r,{once:true}));
  this.ws.send(JSON.stringify({t:'hello',uid:this.uid,token:this.token,active,presence:true}));
  await until(()=>this.messages.some(m=>m.t==='hello'),'hello');
  // Battement de présence d'un onglet visible : ne doit PAS maintenir la salle éveillée.
  if(active)this.beat=setInterval(()=>{try{this.ws.send(JSON.stringify({t:'presence',active:true}));}catch{}},1000);
 }
 async rpc(m,type){const id=++this.seq;this.ws.send(JSON.stringify({...m,id}));await until(()=>this.messages.some(r=>r.t===type&&r.id===id),type);const r=this.messages.find(r=>r.t===type&&r.id===id);if(!r.ok)throw Error(r.error);return r;}
 write(path,value,op='set'){return this.rpc({t:'w',path:'games/'+this.room+'/'+path,op,value},'ack');}
 close(){clearInterval(this.beat);try{this.ws.close();}catch{}}
}
const h=new Client(),p=new Client(),room=('V'+randomUUID().replace(/-/g,'')).slice(0,4).toUpperCase();
try{
 await h.open(room);
 await h.write('meta',{host:h.uid,phase:'lobby',level:'normal',cfg:{nPlayers:2,bots:0,handSize:4,peek:0,adminPlays:true,turnTimer:true,turnSecs:5}});
 await h.rpc({t:'identity',name:'Hote',avatar:'fox'},'res');
 await p.open(room);await p.rpc({t:'identity',name:'Invite',avatar:'cat'},'res');
 await h.write('actions/'+randomUUID(),{type:'launch'});
 await until(()=>h.view.state?.phase==='peek','mémorisation');
 await h.write('state/peekDone/'+h.uid,true);await p.write('state/peekDone/'+p.uid,true);
 await until(()=>h.view.state?.phase==='turn','partie');
 const t0=Date.now();
 // Plus aucune action : malgré les battements visibles, la salle se met en veille.
 await until(()=>h.closed===4001&&p.closed===4001,'veille',IDLE+4000);
 assert.ok(Date.now()-t0>=IDLE-1500,'veille trop tôt');
 assert.ok(h.messages.some(m=>m.t==='sleep')&&p.messages.some(m=>m.t==='sleep'),'message de veille absent');
 const turn=h.view.state.turnNumber; // tour au moment de la veille (le chrono a pu passer un tour avant)
 console.log('Salle inactive : veille après '+Math.round((Date.now()-t0)/100)/10+' s malgré les battements, connexions fermées (4001).');
 // Pendant la veille, le chrono ne doit plus faire passer de tours.
 await pause(12000);
 // Un onglet masqué qui se reconnecte ne réveille pas la salle.
 await p.open(room,false);
 await until(()=>p.closed===4001,'onglet masqué renvoyé en veille',IDLE+4000);
 assert.equal(p.view.state.turnNumber,turn,'des tours sont passés pendant la veille');
 // Retour d'un joueur à l'écran : partie intacte, chrono réarmé.
 await h.open(room);
 await until(()=>h.view.state?.phase==='turn','reprise');
 assert.equal(h.view.state.turnNumber,turn,'partie modifiée pendant la veille');
 assert.ok(h.view.state.turnDeadline>Date.now(),'échéance de tour non recalculée');
 if(process.env.DEBUG_VEILLE){const st=h.view.state;console.log('DEBUG',JSON.stringify({cur:st.order[st.turnIndex]===h.uid?'h':'p',absent:Object.keys(st.absent||{}).map(u=>u===h.uid?'h':'p'),dl:st.turnDeadline-Date.now(),tt:st.turnTimer,turn:st.turnNumber}));}
 await until(()=>h.view.state.turnNumber>turn,'tour passé après réveil (chrono ou absence)',IDLE-1000);
 console.log('Reprise : partie intacte après 12 s de veille, aucun tour passé pendant la veille, minuteurs réarmés au retour (tour passé par le chrono ou la grâce d’absence).');
 h.close();p.close();process.exit(0);
}catch(e){console.error(e);h.close();p.close();process.exit(1);}
