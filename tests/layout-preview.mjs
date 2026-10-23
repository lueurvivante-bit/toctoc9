// Local-only synthetic UI fixtures. No connection, real room, or hidden player state.
// node tests/layout-preview.mjs, then browse http://127.0.0.1:8138/?scene=drawn&players=10
import http from 'node:http';
import {readFileSync} from 'node:fs';
const stub=`<script>
const ref=()=>({set:()=>Promise.resolve(),update:()=>Promise.resolve(),remove:()=>Promise.resolve(),off(){},on(){},child:ref});
const firebase={auth:()=>({signInAnonymously:()=>Promise.resolve(),onAuthStateChanged(){}}),database:Object.assign(()=>({ref}),{ServerValue:{TIMESTAMP:0}})};
const profile='layout',sessionKey='layout-test';
function cloudHeartbeat(){return Promise.resolve()}
</script>`;
http.createServer((req,res)=>{
 if(req.url.startsWith('/brand/')){try{res.end(readFileSync('public'+req.url));}catch{res.writeHead(404);res.end();}return;}
 const q=new URL(req.url,'http://local').searchParams,scene=q.get('scene')||'drawn',n=Number(q.get('players')||2),cards=Number(q.get('cards')||4);
 let html=readFileSync('public/index.html','utf8').replace('<script src="net.js"></script>',stub);
 const boot=`<script>
uid='h';code='DEMO';inGame=true;isHost=true;
const ids=Array.from({length:${n}},(_,i)=>i?'p'+i:'h');
const hand=Array.from({length:${cards}},(_,i)=>({rank:String(i%9+1),suit:'♠'}));myHand=hand;
gstate={phase:'turn',theme:'galaxy',round:1,order:ids,names:Object.fromEntries(ids.map((u,i)=>[u,'Joueur '+(i+1)])),scores:Object.fromEntries(ids.map(u=>[u,0])),hands:Object.fromEntries(ids.map(u=>[u,{count:hand.length,slots:hand.map(()=>1)}])),turnIndex:0,turnNumber:30,handSize:4,peek:1,peekId:'fixture',peekDone:{},deckCount:30,discardTop:{rank:'7',suit:'♥'},limit:30};
const scene=${JSON.stringify(scene)};
if(scene==='peek')gstate.phase='peek';
if(scene==='drawn'||scene==='crowded')myDrawn={rank:'K',suit:'♠'};
if(scene==='crowded'){snapMode=true;gstate.takeResult={by:'h',opponent:'p1',success:false,ts:Date.now()};gstate.absent=Object.fromEntries(ids.slice(1).map(u=>[u,{deadline:Date.now()+10000}]));}
if(scene.startsWith('power'))gstate.pendingFigure={rank:scene==='power-j'?'J':'K',by:'h',step:'choose',accepted:scene!=='power-offer',decisionDeadline:Date.now()+5000};
if(scene==='look'){gstate.pendingFigure={rank:'J',by:'h',step:'look',accepted:true};myLook={rank:'3',suit:'♠'};}
if(scene==='reveal'){gstate.phase='reveal';gstate.reveal=Object.fromEntries(ids.map(u=>[u,hand]));}
if(scene==='over'){gstate.phase='over';gstate.winner={uid:'h'};}
renderGame();setStatus('Aperçu de test','ok');
</script>`;
 html=html.replace('</body>',boot+'</body>');res.setHeader('content-type','text/html; charset=utf-8');res.setHeader('cache-control','no-store');res.end(html);
}).listen(8138,'127.0.0.1',()=>console.log('Synthetic UI only: http://127.0.0.1:8138'));
