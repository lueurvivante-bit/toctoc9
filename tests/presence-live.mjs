// Test technique local de parcours multi-clients ; pas un duel humain ni un test iPhone.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.env.TOCTOC_TEST_URL||'http://127.0.0.1:8137';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,ms=5000){const end=Date.now()+ms;while(Date.now()<end){if(fn())return;await pause(25);}throw Error('Délai : '+label);}
class Client{
 constructor(){this.uid=randomUUID();this.token=randomUUID()+randomUUID();this.seq=0;this.messages=[];this.visible=true;}
 async open(room){this.visible=true;this.room=room;this.view={};this.messages=[];this.ws=new WebSocket(base.replace(/^http/,'ws')+'/ws?room='+room);this.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);this.messages.push(m);if(m.t==='view')Object.assign(this.view,m.d);});await until(()=>this.ws.readyState===1,'socket');this.send({t:'hello',uid:this.uid,token:this.token,active:true,presence:true});await until(()=>this.messages.some(m=>m.t==='hello'),'hello');this.heartbeat=setInterval(()=>{if(this.ws.readyState===1)this.send({t:'presence',active:this.visible});},500);await until(()=>this.view.meta!==undefined,'vue');}
 send(m){this.ws.send(JSON.stringify(m));}
 async rpc(m,type){const id=++this.seq;this.send({...m,id});await until(()=>this.messages.some(r=>r.t===type&&r.id===id),type);const r=this.messages.find(r=>r.t===type&&r.id===id);if(!r.ok)throw Error(r.error);return r;}
 write(path,value,op='set'){return this.rpc({t:'w',path:'games/'+this.room+'/'+path,op,value},'ack');}
 identify(name,avatar){return this.rpc({t:'identity',name,avatar},'res');}
 action(type){return this.write('actions/'+randomUUID(),{type});}
 active(value){this.visible=value;this.send({t:'presence',active:value});}
 close(){clearInterval(this.heartbeat);this.ws.close();}
}
const h=new Client(),p=new Client();let current;
async function create(index){current=('T'+randomUUID().replace(/-/g,'')).slice(0,4).toUpperCase();await h.open(current);await h.write('meta',{host:h.uid,phase:'lobby',level:'normal',cfg:{nPlayers:2,bots:0,handSize:4,peek:1,adminPlays:true,turnTimer:false,turnSecs:10}});await h.identify('H'+index,'fox');await p.open(current);await p.identify('P'+index,'owl');await until(()=>Object.keys(h.view.players||{}).length===2,'deux joueurs');}
try{
 await create(1);await h.action('launch');await until(()=>p.view.state?.phase==='peek','mémorisation');
 p.active(false);await until(()=>h.view.state?.absent?.[p.uid],'absence visible');const deadline=h.view.state.absent[p.uid].deadline;
 // L'horloge distante peut avancer de quelques millisecondes sur celle du client.
 assert.equal(deadline-h.view.state.absent[p.uid].since,10000);
 await h.write('state/peekDone/'+h.uid,true);await pause(10500);assert.equal(h.view.state.phase,'peek');assert.ok(!h.view.state.peekDone?.[p.uid]);
 console.log('Mémorisation interrompue >10 s : quota/validation conservés, aucune auto-mémorisation.');
 p.close();await p.open(current);await until(()=>!h.view.state?.absent?.[p.uid],'retour');await p.write('state/peekDone/'+p.uid,true);await until(()=>h.view.state?.phase==='turn','début');
 assert.equal(h.view.state.order[h.view.state.turnIndex],h.uid);const count=h.view.state.hands[h.uid].count,turn=h.view.state.turnNumber;
 h.active(false);await until(()=>p.view.state?.absent?.[h.uid],'absence h');await pause(8500);assert.equal(p.view.state.turnNumber,turn,'tour passé trop tôt');await until(()=>p.view.state.turnNumber>turn,'tour passé après 10 s',4000);assert.equal(p.view.state.move.type,'skip');assert.equal(p.view.state.hands[h.uid].count,count);
 h.close();await h.open(current);await until(()=>!p.view.state.absent?.[h.uid],'reprise joueur');assert.ok(h.view.state.order.includes(h.uid));await until(()=>h.view.meta.host===h.uid,'retour créateur');
 console.log('Arrière-plan : décompte serveur dix secondes, tour passé sans bot, siège et rôle retrouvés.');
 h.close();p.close();
 for(let i=2;i<=4;i++){await create(i);assert.equal(h.view.players[h.uid].name,'H'+i);await assert.rejects(p.identify('H'+i,'owl'),/pseudo/);await p.identify('P'+i,'owl');await p.write('players/'+p.uid,null,'remove');await until(()=>!h.view.players[p.uid],'départ explicite');h.close();p.close();console.log('Nouvelle salle / nouveau pseudo / refus doublon / départ : cycle '+i+' OK.');}
 console.log('Parcours réseau local terminés ; aucune preuve de fonctionnement sur téléphone physique déduite.');
}finally{try{h.close();p.close();}catch{}}
