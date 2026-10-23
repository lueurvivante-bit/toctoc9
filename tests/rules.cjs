const vm=require('vm'),fs=require('fs'),assert=require('assert/strict');
const html=fs.readFileSync('public/index.html','utf8');const js=html.match(/<script>([\s\S]*)<\/script>/)[1];new Function(js);
const ctx=vm.createContext({});vm.runInContext(js.slice(0,js.indexOf('/* ====== Firebase ====== */')),ctx);
vm.runInContext(`
if(cur=typeof curPeek!=='undefined')throw Error('unexpected');
if(scoreLimit(4)!==30||scoreLimit(6)!==45)throw Error('limits');
if(canKnock(5,false,2)||!canKnock(6,false,2))throw Error('toc timing');
const card=r=>({rank:r,suit:'♠'});
const tie=resolveKnock([{id:'a',hand:[card('2')]},{id:'b',hand:[card('2')]}],'a');
if(tie.success||tie.knockerRoundScore!==3)throw Error('tie penalty');
if(!isValidSnap(card('7'),{rank:'7',suit:'♥'}))throw Error('suit');
if(emptyHandPenalty([{id:'a',hand:[]},{id:'b',hand:[card('K')]}],'a')!==14)throw Error('empty');
if(botDrawDecision({drawn:card('2'),known:[null,10]}).slot!==1)throw Error('bot decision');
`,ctx);
// Load actual handlers in a DOM stub for action permission and memory tests.
const node={style:{},classList:{add(){},remove(){}},appendChild(){},querySelectorAll(){return []}};
const writes=[]; const ref=()=>({set:v=>{writes.push(v);return Promise.resolve()},update:v=>{writes.push(v);return Promise.resolve()},remove:()=>Promise.resolve(),off(){},on(){},child:ref});
const sandbox={__SERVER__:true,console,Math,Date,Set,crypto:require('crypto').webcrypto,window:{},document:{getElementById:()=>({...node}),createElement:()=>({...node}),body:node,addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},firebase:{auth:()=>({signInAnonymously:()=>Promise.resolve(),onAuthStateChanged(){}}),database:Object.assign(()=>({ref}),{ServerValue:{TIMESTAMP:0}})},setInterval(){},setTimeout(){},clearTimeout(){},clearInterval(){},navigator:{},sessionKey:'test'};
vm.createContext(sandbox);vm.runInContext(js,sandbox);
vm.runInContext(`
gstate={peek:0}; if(curPeek()!==0)throw Error('zero peek');
G={peek:1,hands:{bot_1:[{rank:'3'},{rank:'K'}]}};
if(JSON.stringify(botKnowledge('bot_1',G.hands.bot_1))!=='[3,null]')throw Error('hidden bot cards');
isHost=true;gstate={phase:'turn'};G={order:['a','b'],hostId:'a'};
processAction({type:'restart',by:'b'}); // Must reject before touching engine.
`,sandbox);
console.log('11 contrôles : règles, égalité TOC, CLAC, bots, quota zéro, autorisations et syntaxe OK');
const timers=[];sandbox.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length};sandbox.clearTimeout=()=>{};
vm.runInContext(`
for(const [level,ms] of [['facile',5500],['normal',3500],['difficile',2500]]){
 if(botReactionDelay(level)!==ms)throw Error('reaction '+level);
 G={level,order:['bot_1','a'],turnIndex:0,turnNumber:1,round:1,botIds:['bot_1'],discard:[{rank:'4',suit:'♠'}]};
 botTimer=null;gstate={phase:'turn'};maybeScheduleBot();scheduleBotSnaps();
}
`,sandbox);
assert.deepEqual(timers.map(t=>t.ms),[5500,5500,3500,3500,2500,2500]);
console.log('Délais de tour et CLAC : 5,5 / 3,5 / 2,5 secondes OK');
vm.runInContext(`
const sent=[];postAction=a=>sent.push(a);renderGame=()=>{};uid='me';
for(const rank of ['Q','K']) for(const first of ['mine','opp']){
 gstate={pendingFigure:{by:'me',step:'choose',rank}};figSel=null;
 if(first==='mine'){selectExchangeCard('mine',2);if(sent.length%1!==0)throw Error('early');selectExchangeCard('opp',1,'them');}
 else{selectExchangeCard('opp',1,'them');selectExchangeCard('mine',2);}
 const a=sent.at(-1);if(a.mine!==2||a.opp!=='them'||a.oslot!==1||a.type!=='fig_swap')throw Error('selection order');
}
if(sent.filter(a=>a.type==='fig_swap').length!==4)throw Error('duplicate exchange');
gstate={move:{type:'penalty',who:'me',slot:4,ts:Date.now()}};
if(arrivalFor('me').slot!==4 || arrivalFor('them')!==null)throw Error('penalty marker');
gstate={move:{type:'figswap',who:'them',slot:0,opp:'me',oslot:3,ts:Date.now()}};
if(arrivalFor('me').slot!==3)throw Error('incoming opponent swap');
let published;pushState=x=>published=x;writeHand=()=>{};drawCard=()=>({rank:'9',suit:'♥'});
gstate={phase:'turn'};G={hands:{me:[{rank:'2',suit:'♠'},null]},discard:[{rank:'3',suit:'♠'}],snapSkipTurn:false};
doSnap('me',0);if(published.move.slot!==1||published.move.type!=='penalty')throw Error('refilled penalty slot');
G.hands.me=[{rank:'2',suit:'♠'}];G.snapFailed={};doSnap('me',0); // scénario indépendant : garde anti-doublon remise à zéro
if(published.move.slot!==1||G.hands.me.length!==2)throw Error('appended penalty slot');
`,sandbox);
console.log('Roi/Dame : 4 ordres vérifiés ; pénalité : case vide et ajout à droite vérifiés');
vm.runInContext(`
checkEmptyHand=()=>false;scheduleBotSnaps=()=>{};botFigure=()=>{};
for(const rank of ['J','Q','K']){
 gstate={phase:'turn'};G={order:['other','me'],turnIndex:0,turnNumber:7,hands:{me:[{rank,suit:'♠'},{rank:'2',suit:'♥'}]},discard:[{rank,suit:'♥'}],_drawn:{rank:'5',suit:'♣'},_fig:null};
 doSnap('me',0);
 if(G._fig?.rank!==rank||!G._fig.fromSnap||G._fig.by!=='me')throw Error('CLAC figure '+rank);
 finishFigure();
 if(G.turnIndex!==0||G.turnNumber!==7||G._drawn.rank!=='5'||G._fig)throw Error('resume interrupted turn');
}
G={order:['me','other'],turnIndex:0,turnNumber:0,_fig:{by:'me',rank:'Q'},hands:{}};
finishFigure();if(G.turnIndex!==1||G.turnNumber!==1)throw Error('normal figure still advances');
gstate={phase:'turn'};G={hands:{me:[{rank:'2',suit:'♠'}]},discard:[{rank:'2',suit:'♥'}],_fig:{by:'other',rank:'K'}};
doSnap('me',0);if(G.hands.me[0]===null||G._fig.by!=='other')throw Error('nested power overwrite');
`,sandbox);
console.log('CLAC J/Q/K : pouvoir activé, tour et pioche conservés, pas de pouvoir imbriqué');
vm.runInContext(`
let rendered='';render=h=>rendered=h;
uid='me';inGame=true;myDrawn=null;myLook=null;figSel=null;snapMode=false;
myHand=[{rank:'2'},null,null,null,{rank:'5'},{rank:'6'}];
gstate={phase:'turn',round:1,order:['me','other'],names:{me:'Moi',other:'Autre'},turnIndex:0,turnNumber:0,scores:{me:0,other:0},hands:{me:{slots:[1,0,0,0,1,1]},other:{slots:[1,0,1]}},deckCount:10,discardTop:{rank:'3',suit:'♠'}};
renderTurn();
if(rendered.includes('class="gone"')||rendered.includes('Ta carte 4'))throw Error('empty slots displayed');
for(const n of [1,2,3])if(!rendered.includes('aria-label="Ta carte '+n+'"'))throw Error('visible numbering');
if(!rendered.includes('data-mine="4"')||!rendered.includes('data-mine="5"'))throw Error('card identity lost');
if(visualCardPosition('me',4)!==2||visualCardPosition('other',2)!==2)throw Error('position mapping');
`,sandbox);
const slides=[];
sandbox.document.querySelectorAll=()=>[{dataset:{cardAt:'me:4'},getBoundingClientRect:()=>({left:150,top:200}),animate:(frames,opts)=>slides.push({frames,opts})}];
vm.runInContext("layoutPositions=new Map([['me:4',{left:350,top:200}]]);animateHandLayout();",sandbox);
assert.equal(slides.length,1);assert.equal(slides[0].frames[0].transform,'translate(200px,0px)');assert.equal(slides[0].opts.duration,260);
console.log('Resserrement : sans trous, numérotation continue, identité conservée et coulissement 260 ms OK');
const feedback={textContent:'',classList:{add:n=>assert.equal(n,'visible'),remove(){}}};sandbox.document.getElementById=id=>id==='snapFeedback'?feedback:{...sandbox.document.body};
vm.runInContext(`
playSfx=()=>{};buzz=()=>{};bigFlash=()=>{throw Error('central CLAC overlay');};
_prevSig={ti:0,ph:'turn',top:'9♥',kn:false,fig:'',myc:2};
uid='me';onStateFx({phase:'turn',order:['me','other'],turnIndex:0,hands:{me:{count:1}},discardTop:{rank:'9',suit:'♥'}});
`,sandbox);
assert.equal(feedback.textContent,'✓ Prise réussie');
console.log('CLAC : notification discrète, aucun flash central OK');
const decisionTimers=[];sandbox.setTimeout=(fn,ms)=>{decisionTimers.push({fn,ms});return decisionTimers.length};
vm.runInContext(`
isHost=true;code='decision-test';gstate={phase:'turn'};
G={order:['me','other'],turnIndex:0,turnNumber:2,_fig:{by:'me',rank:'Q',step:'choose',decisionDeadline:Date.now()+5000}};
schedulePowerDecision();
`,sandbox);
assert.ok(decisionTimers.at(-1).ms>4900&&decisionTimers.at(-1).ms<=5000);decisionTimers.at(-1).fn();
vm.runInContext("if(G._fig||G.turnIndex!==1||G.turnNumber!==3)throw Error('automatic skip');",sandbox);
vm.runInContext(`G={order:['me','other'],turnIndex:0,turnNumber:2,_drawn:{rank:'3'},_fig:{by:'me',rank:'K',step:'choose',fromSnap:true,decisionDeadline:Date.now()+5000}};schedulePowerDecision();`,sandbox);
decisionTimers.at(-1).fn();vm.runInContext("if(G.turnIndex!==0||!G._drawn)throw Error('CLAC timer resume');",sandbox);
const countBefore=decisionTimers.length;
vm.runInContext("G._fig={by:'me',rank:'K',step:'choose',accepted:true};schedulePowerDecision();",sandbox);
assert.equal(decisionTimers.length,countBefore);
console.log('Décision pouvoir : cinq secondes, passage automatique, CLAC repris et acceptation conservée OK');
vm.runInContext(`
function takeFixture(rank){gstate={phase:'turn'};G={order:['me','other','third'],turnIndex:2,turnNumber:8,hands:{me:[{rank:'2',suit:'♠'}],other:[{rank,suit:'♥'}],third:[{rank:'4',suit:'♠'}]},discard:[{rank:'Q',suit:'♠'}],_fig:null,skip:{}};}
takeFixture('Q');doTake('me','other',0);
if(G.hands.other.filter(Boolean).length!==2||G.hands.me.length!==1||!G._fig?.reward||G._fig.rank!=='J')throw Error('successful take: two penalties/reward');
if(G.discard.at(-1).rank!=='Q'||G.turnIndex!==2)throw Error('take turn/figure');
takeFixture('K');doTake('me','other',0);
if(!G.takeBlocked.me||!G.skip.me||G.hands.me.length!==2||!G.protectedCards.other[0]||G.hands.other[0].rank!=='K')throw Error('failed take consequences');
const before=G.hands.third.length;doTake('me','third',0);if(G.hands.third.length!==before)throw Error('blocked take');
doTake('third','other',0);if(G.takeBlocked.third)throw Error('protected target');
G.discard.push({rank:'2',suit:'♥'});doSnap('me',0);if(G.hands.me[0]!==null)throw Error('own CLAC still allowed');
G.turnIndex=2;advanceTurn();if(G.order[G.turnIndex]!=='other'||G.skip.me!==false)throw Error('skip next current-round turn');
G.discard.push({rank:'K',suit:'♠'});doSnap('other',0);if(G.protectedCards.other[0]||G.hands.other[0]!==null)throw Error('owner may discard protected card');
`,sandbox);
console.log('Prendre : réussite +2, récompense, erreur +1/interdiction/tour sauté, protection et CLAC propriétaire OK');
vm.runInContext(`
// Prise visée : la carte de défausse affichée accompagne snap/take.
let notices=[],pushed=[];stateRef={update:v=>notices.push(v)};pushState=x=>pushed.push(x);
const top={rank:'6',suit:'♥'},stale={rank:'J',suit:'♠'};
function snapFixture(){notices=[];pushed=[];gstate={phase:'turn'};G={order:['me','other'],turnIndex:1,turnNumber:4,hands:{me:[{rank:'6',suit:'♠'},{rank:'2',suit:'♣'},{rank:'3',suit:'♦'}],other:[{rank:'6',suit:'♣'},{rank:'9',suit:'♣'}]},discard:[{rank:'4',suit:'♠'},{...top}],deck:[{rank:'8',suit:'♣'},{rank:'7',suit:'♣'},{rank:'5',suit:'♣'}],_fig:null,skip:{},snapSkipTurn:true};}
snapFixture();doSnap('me',0,stale);
if(G.hands.me.length!==3||!G.hands.me[0]||pushed.length||G.skip.me||notices.at(-1)?.takeNotice?.kind!=='stale'||notices.at(-1).takeNotice.by!=='me')throw Error('stale snap penalised');
snapFixture();doSnap('me',1,top);
if(G.hands.me.length!==4||pushed.at(-1)?.move?.type!=='penalty'||!G.skip.me)throw Error('matching target, wrong value: penalty expected');
doSnap('me',1,top);doSnap('me',1);
if(G.hands.me.length!==4||notices.at(-1)?.takeNotice?.kind!=='repeat')throw Error('double tap penalised twice');
doSnap('me',2,top);if(G.hands.me.length!==5)throw Error('different wrong card must still be penalised');
snapFixture();doSnap('me',0,top);
if(G.hands.me[0]!==null||G.discard.at(-1).rank!=='6'||G.hands.me.length!==3)throw Error('matching target, right value: success expected');
snapFixture();doSnap('me',0);if(G.hands.me[0]!==null)throw Error('legacy snap without target');
snapFixture();G.discard.push({rank:'J',suit:'♠'});doSnap('me',0);if(G.hands.me.length!==4)throw Error('legacy snap judged against current top');
snapFixture();doTake('me','other',0,stale);
if(G.hands.other[0]?.rank!=='6'||G.takeBlocked?.me||G.hands.me.length!==3||pushed.length||notices.at(-1)?.takeNotice?.kind!=='stale')throw Error('stale take penalised');
snapFixture();doTake('me','other',1,top);
if(!G.takeBlocked.me||G.hands.me.length!==4)throw Error('matching take, wrong value: penalty expected');
doTake('me','other',1,top);if(G.hands.me.length!==4)throw Error('double take penalised twice');
snapFixture();G.round=2;doSnap('me',0,{...top,round:1});
if(G.hands.me[0]?.rank!=='6'||pushed.length||notices.at(-1)?.takeNotice?.kind!=='stale')throw Error('target from previous round must be stale');
snapFixture();G.round=2;doSnap('me',0,{...top,round:2});if(G.hands.me[0]!==null)throw Error('same-round target must be judged normally');
snapFixture();doTake('me','other',0,top);
if(G.hands.other.filter(Boolean).length!==3||G.discard.at(-1).rank!=='6'||G.discard.at(-1).suit!=='♣'||G.takeBlocked?.me)throw Error('matching take, right value: success expected');
`,sandbox);
console.log('Prise visée : défausse changée sans pénalité, mauvaise valeur pénalisée, bonne valeur réussie, double appui pénalisé une seule fois, ancien format inchangé OK');
const storage=new Map();sandbox.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
vm.runInContext(`
code='same-room';uid='me';gstate={peekId:'deal-a',round:1,peek:1,order:['me'],peekDone:{}};
localStorage.setItem(peekStorageKey(),'[0]');
gstate.peekId='deal-b';if(peekProgress().length)throw Error('new deal reused quota');
myHand=[{rank:'2',suit:'♠'},{rank:'3',suit:'♥'}];
let peekHtml='';render=h=>peekHtml=h;renderPeek();
if(!peekHtml.includes('id="peekDone" disabled'))throw Error('ready before memorizing');
localStorage.setItem(peekStorageKey(),'[0]');renderPeek();
if(peekHtml.includes('id="peekDone" disabled'))throw Error('ready after memorizing');
`,sandbox);
sandbox.Math=Object.create(Math);sandbox.Math.random=()=>.5;
vm.runInContext(`
G={order:['bot_1','me'],botSkill:1,level:'difficile',hands:{bot_1:[{rank:'2'}],me:[{rank:'K'}]},discard:[{rank:'K'}]};
rememberOpponent('bot_1','me',0,13);
const attempt=botTakeDecision('bot_1');if(attempt?.opponent!=='me'||attempt.slot!==0)throw Error('expert take');
G.takeBlocked={bot_1:true};if(botTakeDecision('bot_1'))throw Error('blocked bot');G.takeBlocked={};
G.protectedCards={me:{0:{rank:'K'}}};if(botTakeDecision('bot_1'))throw Error('protected bot target');G.protectedCards={};
forgetOpponentHand('me');if(botTakeDecision('bot_1'))throw Error('stale bot knowledge');
G.botSkill=.45;rememberOpponent('bot_1','me',0,13);if(G.botOpponentMemory.bot_1.me[0]!=null)throw Error('easy retention');
`,sandbox);
console.log('Nouvelle distribution : quota neuf et Prêt bloqué avant mémorisation ; bots : mémoire, niveau, protection et interdiction OK');
vm.runInContext(`
gstate={order:['me','bot_1','bot_2'],turnIndex:0,skippedTurns:{bot_1:true},names:{me:'Moi',bot_1:'Bot 1',bot_2:'Bot 2'},scores:{me:0,bot_1:0,bot_2:0}};
if(nextTurnPlayer()!=='bot_2')throw Error('next player ignores skipped turn');
gstate.turnIndex=2;if(nextTurnPlayer()!=='me')throw Error('turn cycle wrap');
const ribbon=turnOrderBar();if(!ribbon.includes('joue maintenant')||!ribbon.includes('joue ensuite'))throw Error('current/next markers');
`,sandbox);
console.log('Ordre des tours : boucle, prochain joueur et tour sauté OK');

vm.runInContext(`
render=h=>rendered=h;uid='me';inGame=true;myDrawn=null;myLook=null;snapMode=false;myHand=[{rank:'2',suit:'♠'}];
gstate={phase:'turn',round:1,order:['me','other'],names:{me:'Moi',other:'Autre'},turnIndex:0,turnNumber:8,scores:{me:0,other:0},hands:{me:{slots:[1]},other:{slots:[1]}},deckCount:10,discardTop:{rank:'3',suit:'♠'},protectedCards:{other:{0:{rank:'Q',suit:'♣'}}},takeResult:{by:'me',opponent:'other',slot:0,success:false,ts:Date.now()}};
if(revealedProtectedCard('other',0)?.rank!=='Q')throw Error('brief reveal missing');
if(revealedProtectedCard('me',0)||revealedProtectedCard('other',1))throw Error('wrong card revealed');
gstate.takeResult.ts=Date.now()-1600;
if(revealedProtectedCard('other',0))throw Error('protected card stays revealed');
renderTurn();
if(rendered.includes('>Q<')||!rendered.includes('🔒'))throw Error('hidden protected card markup');
uid='other';myHand=[{rank:'Q',suit:'♣'}];snapMode=true;renderTurn();
if(rendered.includes('>Q<')||!rendered.includes('data-mine="0"'))throw Error('owner hidden card not actionable');
`,sandbox);
console.log('Carte protégée : révélation 1,5 s puis dos et cadenas ; sélection propriétaire conservée OK');

(async()=>{
 const count=await vm.runInContext(`(async()=>{
   let cases=0;isHost=true;uid='host';code='audit';metaRef={update:()=>Promise.resolve()};
   for(const level of ['facile','normal','difficile'])for(const handSize of [4,5,6])for(let peek=0;peek<=handSize;peek++)for(const adminPlays of [true,false])for(const nPlayers of [2,6,10]){
     hostCfg={level,handSize,peek,adminPlays,nPlayers,bots:nPlayers-(adminPlays?1:0),snapSkipTurn:false,turnTimer:false,turnSecs:15};
     await launchGame([{uid:'host',name:'Hôte'}]);
     if(G.order.length!==nPlayers||Object.values(G.hands).some(h=>h.length!==handSize||h.some(c=>!c)))throw Error('distribution '+JSON.stringify(hostCfg));
     if(new Set(G.order.map(u=>G.avatars[u])).size!==nPlayers)throw Error('duplicate character');
     if(G.peek!==peek||G.handSize!==handSize||G.limit!==scoreLimit(handSize))throw Error('settings not applied');
     if(G.order.includes('host')!==adminPlays)throw Error('observer received hand');
     if(G.deck.length+nPlayers*handSize+G.discard.length!==packCount(nPlayers)*52)throw Error('deck conservation');
     const normalized=normalizeConfig(hostCfg);if(normalized.peek!==peek)throw Error('peek clamp');
     cases++;
   }
   const c=normalizeConfig({nPlayers:99,handSize:3,peek:99,bots:99,turnSecs:31});
   if(c.nPlayers!==10||c.handSize!==4||c.peek!==4||c.bots!==9||c.turnSecs!==20)throw Error('bounds');
   return cases;
 })()`,sandbox);
 assert.equal(count,324);console.log('Audit organisateur → moteur : 324 distributions vérifiées (2/6/10 joueurs, 4/5/6 cartes, tous quotas, trois niveaux et observateur)');
})().catch(e=>{console.error(e);process.exitCode=1});
// Isolated live binding tests for the actual peek click handlers.
const peekSandbox={...sandbox,Math:Object.create(Math)};vm.createContext(peekSandbox);
// Use a fresh runtime, because earlier tests intentionally replace some handlers.
peekSandbox.document={...sandbox.document,getElementById:()=>({...node}),querySelectorAll:()=>[]};
peekSandbox.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
vm.runInContext(js,peekSandbox);
for(const quota of [0,1,2,6]){
 storage.clear();const pd={disabled:quota>0};const cells=Array.from({length:6},(_,i)=>({dataset:{peek:String(i)},isConnected:true,click(){this.onclick()}}));
 peekSandbox.peekButton=pd;peekSandbox.peekCells=cells;
 peekSandbox.document.getElementById=id=>id==='peekDone'?pd:null;
 const start=writes.length;
 vm.runInContext(`code='quota';uid='me';inGame=true;gstate={phase:'peek',round:1,peekId:'quota-${quota}',handSize:6,peek:${quota},order:['me'],peekDone:{}};myHand=Array.from({length:6},()=>({rank:'2',suit:'♠'}));screen.querySelectorAll=selector=>selector==='[data-peek]'?peekCells:[];playSfx=()=>{};buzz=()=>{};toast=()=>{};bind();`,peekSandbox);
 if(quota>0){pd.onclick();assert.equal(writes.length,start);}
 for(const cell of cells)cell.onclick();
 vm.runInContext(`if(peekProgress().length!==${quota})throw Error('quota exceeded');`,peekSandbox);
 assert.equal(pd.disabled,false);pd.onclick();assert.equal(writes.at(-1),true);
}
console.log('Mémorisation : boutons réels testés pour quotas 0/1/2/6, pas de dépassement et validation protégée');
(async()=>{
 await new Promise(setImmediate);
 await vm.runInContext(`(async()=>{
   if(normalizeConfig({}).turnSecs!==10)throw Error('default timer');
   if(normalizeConfig({turnSecs:3}).turnSecs!==5||normalizeConfig({turnSecs:30}).turnSecs!==20||normalizeConfig({turnSecs:17}).turnSecs!==17)throw Error('timer bounds');
   for(const theme of VISUAL_THEMES)if(normalizeConfig({theme:theme.id}).theme!==theme.id)throw Error('theme lost');
   isHost=true;uid='host';code='settings';hostCfg={level:'facile',botLevel:'difficile',theme:'midnight',nPlayers:2,bots:1,handSize:6,peek:0,turnTimer:true,turnSecs:17};
   await launchGame([{uid:'host',name:'Hôte'}]);
   if(G.botSkill!==1||G.botLevel!=='difficile'||G.peek!==0||G.handSize!==6||G.theme!=='midnight'||G.turnSecs!==17)throw Error('settings independence');
 })()`,sandbox);
 const publicState=[...writes].reverse().find(x=>x?.phase==='peek');assert.equal(publicState.theme,'midnight');assert.equal(publicState.botLevel,'difficile');assert.equal(publicState.turnSecs,17);
 console.log('Réglages : chrono 5–20 s/default 10, difficulté indépendante et tous les thèmes publiés correctement OK');
 // Regression: action controls must be siblings of the fitting surface, never inside it.
 vm.runInContext(`
   var layoutMarkup='';render=function(h){layoutMarkup=h;};
   uid='layout';code='layout';inGame=true;isHost=false;myDrawn=null;myLook=null;
   for(const count of [2,10])for(const quota of [0,1,6]){
     myHand=Array.from({length:6},()=>({rank:'3',suit:'♠'}));
     gstate={phase:'peek',peek:quota,peekId:'layout',round:1,handSize:6,order:[uid,...Array.from({length:count-1},(_,i)=>'bot_'+i)],scores:{},hands:{},names:{},turnIndex:0,turnNumber:8};
     gstate.order.forEach(u=>{gstate.scores[u]=0;gstate.hands[u]={count:6,slots:[1,1,1,1,1,1]};gstate.names[u]=u;});
     for(const phase of ['peek','turn']){
       gstate.phase=phase;layoutMarkup='';if(phase==='peek')renderPeek();else renderTurn();
       const boundary=layoutMarkup.indexOf('<div class="play-actions">');
       if(boundary<0)throw Error('missing action area '+phase);
       const prefix=layoutMarkup.slice(0,boundary);
       const depth=(prefix.match(/<div(?: | >|>)/g)||[]).length-(prefix.split('</div>').length-1);
       if(depth!==0)throw Error('action area nested in table: '+phase+' depth '+depth);
     }
   }
 `,sandbox);
 console.log('Mise en page : actions hors de la table, mémorisation et partie, 2/10 joueurs et quotas 0/1/6 OK');
 vm.runInContext(`
   var resultText;stateRef={update:v=>{resultText=v;}};saveEngine=function(){};
   G={order:['layout','opponent'],scores:{layout:0,opponent:0},hands:{layout:[],opponent:[]},names:{layout:'Gagnant',opponent:'Autre'},limit:30,eliminated:[]};
   finishRound({layout:33,opponent:43},'TOC');
   if(resultText.winner.uid!=='layout'||resultText.eliminated.includes('layout'))throw Error('winner changed');
   if(!resultText.verdict.includes('plus petit total')||resultText.verdict.includes('éliminés'))throw Error('contradictory verdict');
   gstate={...resultText,names:G.names,order:G.order,limit:30,verdict:'Tous dépassent 30 — éliminés !'};
   renderOver();
   if(layoutMarkup.includes('éliminés !')||!layoutMarkup.includes('plus petit total'))throw Error('legacy verdict displayed');
 `,sandbox);
 console.log('Résultat : dépassement simultané, gagnant au plus petit total et verdict cohérent OK');


})().catch(e=>{console.error(e);process.exitCode=1});

// Décalage d'horloge serveur de 50 ms : ne jamais annoncer 11 s/6 s pour 10 s/5 s.
vm.runInContext(`
const absenceLabel={dataset:{absenceDeadline:Date.now()+10050},textContent:''};
const powerLabel={textContent:''};
document.querySelectorAll=()=>[absenceLabel];
document.getElementById=id=>id==='powerClock'?powerLabel:null;
gstate={pendingFigure:{decisionDeadline:Date.now()+5050}};
updateCountdown();
if(absenceLabel.textContent!==10||powerLabel.textContent!=='5 s')throw Error('clock skew inflated countdown');
absenceLabel.dataset.absenceDeadline=Date.now()-100;gstate.pendingFigure.decisionDeadline=Date.now()-100;
updateCountdown();if(absenceLabel.textContent!==0||powerLabel.textContent!=='0 s')throw Error('expired countdown');
`,sandbox);
console.log('Horloges légèrement décalées : compteurs bornés à dix/cinq secondes, expiration à zéro OK');
