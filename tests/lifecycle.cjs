const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const js=fs.readFileSync('public/index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const nodes=new Map(),memory=new Map(),writes=[],released=[];
function node(){return {style:{},classList:{add(){},remove(){}},setAttribute(k,v){this[k]=v},appendChild(n){nodes.set(n.id,n)},remove(){nodes.delete(this.id)},querySelectorAll(){return []}}}
for(const id of ['screen','status','statusText'])nodes.set(id,node());
const body=node(),ref=path=>({set(v){writes.push({path,v});return Promise.resolve()},update(){return Promise.resolve()},remove(){return Promise.resolve()},off(){},on(){},onDisconnect(){return {cancel(){}}},child:k=>ref(path+'/'+k)});
const s={__SERVER__:true,console,Math,Date,Set,crypto:require('node:crypto').webcrypto,window:{cloudReleaseRoom:c=>released.push(c)},document:{getElementById:id=>nodes.get(id)||null,createElement:node,body,addEventListener(){}},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},firebase:{auth:()=>({signInAnonymously:()=>Promise.resolve(),onAuthStateChanged(){}}),database:Object.assign(()=>({ref}),{ServerValue:{TIMESTAMP:0}})},setInterval(){},setTimeout(){},clearTimeout(){},clearInterval(){},navigator:{},sessionKey:'test',confirm(){throw Error('native dialog forbidden')}};
vm.createContext(s);vm.runInContext(js,s);
const run=x=>vm.runInContext(x,s),flush=()=>new Promise(setImmediate);
(async()=>{
 run("render=()=>{};toast=()=>{};uid='me';draft={hostName:'Premier',avatar:'fox',level:'normal',nPlayers:2,handSize:4,peek:1,bots:0};genCode=()=> 'AAAA';joinRoom=(name)=>{window.joined={name,code}};");
 const meta=deferred();s.meta=meta;run('db.ref=()=>({set:()=>meta.promise});reserveIdentity=()=>Promise.resolve();');
 const first=run('createSession()'),second=run('createSession()');await second;
 assert.equal(run('roomOperation'),1,'double creation starts another operation');
 meta.resolve();await first;assert.deepEqual({...s.window.joined},{name:'Premier',code:'AAAA'});
 // Cancelling an old screen and creating a different room must invalidate its delayed reply.
 run("homeScreen();code=null;draft.hostName='Ancien';genCode=()=> 'OLD1';");
 const old=deferred(),fresh=deferred();s.old=old;s.fresh=fresh;
 run("db.ref=p=>({set:()=>p.includes('OLD1')?old.promise:fresh.promise});");
 const stale=run('createSession()');run("homeScreen();draft.hostName='Nouveau';genCode=()=> 'NEW1';");
 const current=run('createSession()');old.resolve();await stale;
 assert.equal(run('roomBusy'),true,'stale callback unlocked current request');assert.equal(run('code'),null,'stale callback joined old room');
 fresh.resolve();await current;assert.deepEqual({...s.window.joined},{name:'Nouveau',code:'NEW1'});assert.ok(released.includes('OLD1'));
 // Joining is also single-flight; returning home cancels the old result.
 run("homeScreen();code=null;joinAvatar='owl';");
 const joinMeta=deferred();s.joinMeta=joinMeta;
 run("db.ref=()=>({once:()=>joinMeta.promise});");
 const join=run("joinSession('Invité','JOIN')"),doubleJoin=run("joinSession('Autre','JOIN')");await doubleJoin;
 run('homeScreen()');joinMeta.resolve({exists:()=>true,val:()=>({phase:'lobby',host:'other',cfg:{}})});await join;
 assert.equal(run('code'),null,'cancelled join entered room');
 run("db.ref=()=>({once:()=>Promise.resolve({exists:()=>true,val:()=>({phase:'lobby',host:'other',cfg:{}})})});");
 await run("joinSession('Invité neuf','JOIN')");assert.deepEqual({...s.window.joined},{name:'Invité neuf',code:'JOIN'});
 // Actual in-page cancel has no leave side effect and never calls native confirm.
 nodes.set('stayInGame',node());nodes.set('confirmQuit',node());nodes.set('quitError',node());run('quitGame()');
 assert.equal(nodes.get('quitPanel').role,'dialog');nodes.get('stayInGame').onclick();assert.ok(!nodes.has('quitPanel'));assert.equal(run('code'),'JOIN');
 // Explicit departure must wait for action ACK and player removal before releasing room/identity.
 const ack=deferred(),removed=deferred();s.ack=ack;s.removed=removed;
 run("code='LIVE';isHost=false;G=null;inGame=true;db.ref=p=>({set:v=>{window.leaveAction=v;return ack.promise}});meRef={onDisconnect:()=>({cancel(){}}),remove:()=>removed.promise};detachAll=()=>{};");
 const departure=run('quitGameConfirmed()');assert.equal(s.window.leaveAction.type,'leave');assert.equal(run('code'),'LIVE');
 ack.resolve();await flush();assert.equal(run('code'),'LIVE');assert.ok(!released.includes('LIVE'));
 removed.resolve();await departure;assert.equal(run('code'),null);assert.ok(released.includes('LIVE'));assert.equal(run('inGame'),false);
 console.log('Cycle de salle : double création, réponse tardive, nouveau pseudo/salle, annulation et sortie confirmée sans dialogue natif OK');
})().catch(e=>{console.error(e);process.exitCode=1});
