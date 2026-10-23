import { createRuntime } from '../src/engine.gen.js';
import { Store, serverFirebase } from '../src/store.js';
const store=new Store(()=>{});
const rt=createRuntime({firebase:serverFirebase(store),setTimeout,clearTimeout});
store.ref('games/ABCD/meta').set({host:'h',phase:'lobby',level:'normal',cfg:{nPlayers:3,bots:1,adminPlays:true}});
store.ref('games/ABCD/players/h').set({name:'Jo',avatar:'fox',joinedAt:1});
store.ref('games/ABCD/players/p').set({name:'Al',avatar:'cat',joinedAt:2});
rt.attach('ABCD','h');
const t=rt.launch('h',[{uid:'h',name:'Jo',avatar:'fox'},{uid:'p',name:'Al',avatar:'cat'}],store.get('games/ABCD/meta'),{});
if(t)throw Error(t);
await new Promise(r=>setTimeout(r,10));
const g=store.get('games/ABCD');
if(g.state.phase!=='peek'||g.meta.phase!=='playing')throw Error('lancement');
store.ref('games/ABCD/state/peekDone/h').set(true);store.ref('games/ABCD/state/peekDone/p').set(true);
await new Promise(r=>setTimeout(r,10));
if(store.get('games/ABCD/state/phase')!=='turn')throw Error('peek');
rt.action({type:'draw',by:'h',ts:Date.now()});
await new Promise(r=>setTimeout(r,10));
if(!store.get('games/ABCD/private/h/drawn'))throw Error('pioche');
rt.action({type:'discard',by:'h',ts:Date.now()});
await new Promise(r=>setTimeout(r,10));

// Prise visée via le moteur serveur réel : le champ « top » traverse processAction.
if(store.get('games/ABCD/state/pendingFigure')){rt.action({type:'fig_skip',by:'h',ts:Date.now()});await new Promise(r=>setTimeout(r,10));}
const countOf=()=>store.get('games/ABCD/hands/h').filter(Boolean).length;
const top=store.get('games/ABCD/state/discardTop'),n0=countOf();
rt.action({type:'snap',by:'h',slot:0,top:{rank:top.rank==='A'?'2':'A',suit:top.suit},ts:Date.now()});
await new Promise(r=>setTimeout(r,10));
if(countOf()!==n0||store.get('games/ABCD/state/takeNotice')?.kind!=='stale')throw Error('prise périmée pénalisée');
const wrong=store.get('games/ABCD/hands/h').findIndex(c=>c&&c.rank!==top.rank);
rt.action({type:'snap',by:'h',slot:wrong,top:{rank:top.rank,suit:top.suit},ts:Date.now()});
rt.action({type:'snap',by:'h',slot:wrong,top:{rank:top.rank,suit:top.suit},ts:Date.now()});
await new Promise(r=>setTimeout(r,10));
if(countOf()!==n0+1||store.get('games/ABCD/state/takeNotice')?.kind!=='repeat')throw Error('double appui : une seule pénalité attendue');
const st=JSON.stringify(store.get('games/ABCD/state'));
if(st.includes('"deck"')||st.includes('"_drawn"'))throw Error('fuite dans l’état public');
console.log('Moteur serveur : lancement, mémorisation, pioche, défausse, prise visée (périmée/double appui), aucune carte cachée dans l’état public OK');
// Les nouvelles ambiances doivent traverser la configuration et l’état public de salle.
for(const theme of ['forest','signature','galaxy','impulse']){
 const localStore=new Store(()=>{}),runtime=createRuntime({firebase:serverFirebase(localStore),setTimeout,clearTimeout});
 const meta={host:'h',phase:'lobby',cfg:{theme,nPlayers:2,bots:0,handSize:4,peek:1,adminPlays:true}};
 localStore.ref('games/THEM/meta').set(meta);
 const players=[{uid:'h',name:'H',avatar:'fox'},{uid:'p',name:'P',avatar:'owl'}];
 for(const player of players)localStore.ref('games/THEM/players/'+player.uid).set(player);
 runtime.attach('THEM','h');const error=runtime.launch('h',players,meta,{});if(error)throw Error(error);
 await new Promise(r=>setTimeout(r,10));
 const state=localStore.get('games/THEM/state');
 if(state.theme!==theme||state.phase!=='peek'||state.order.length!==2)throw Error('ambiance non transmise '+theme);
 if(localStore.get('games/THEM/hands/h').filter(Boolean).length!==4)throw Error('ambiance change les cartes');
}
console.log('Ambiances casino/signature/galaxie/impulsion : configuration transmise à la table, distribution inchangée OK');
process.exit(0);
