// node echo-startstelle-test.js <index.html> : tests real grid/start-position functions extracted from index.html
const fs=require('fs'),html=fs.readFileSync(process.argv[2],'utf8');
const js=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');new Function(js);
const grab=n=>{const i=js.indexOf(n);if(i<0)throw Error('missing '+n);let d=0,j=js.indexOf('{',i);for(let k=j;;k++){if(js[k]=='{')d++;if(js[k]=='}'&&--d==0)return js.slice(i,k+1)}};
const ok=(c,m)=>{if(!c)throw Error('FAIL: '+m);console.log('ok',m)};
const NAMES=['function partStart','function partEnd','function partOf','function setGridAt','function partAt','function calcParts','function changeSeg','async function playSource'];
function env(dur,seg){
  const E={segOffset:0,SEGMENT_SECONDS:seg,sourceDuration:dur,parts:1,currentPart:0,SKIP_REMAINDER_SECONDS:1,sessionActive:false,running:false,shadow:false,
    stageToken:1,S:{listen:1},canRecord:true,CAP_TEXT:'',activeCtl:null,segLen:0,seeks:[],Math,setTimeout};
  E.$=()=>({set textContent(v){}});E.refreshSegUI=()=>{};E.formatTime=t=>String(t);E.runRound=()=>{E.restarted=true};
  E.sourceAudio={paused:true,currentTime:0,pause(){}};Object.defineProperty(E.sourceAudio,'currentTime',{set(v){E.seeks.push(v)},get(){return E.ct||0}});
  E.elCtl=()=>({});E.playMedia=()=>{};E.setStatus=()=>{};E.finish=()=>{E.finished=true};E.clampListen=v=>v;
  E.stage=async(ms,t)=>t===E.stageToken;
  new Function('E',`with(E){${NAMES.map(n=>{const g=grab(n),nm=g.match(/function (\w+)/)[1];return `E.${nm}=${g.replace(/^(async )?function \w+/,'$1function')};`}).join('\n')}}`)(E);
  E.calcParts();return E;
}
const starts=E=>Array.from({length:E.parts},(_,p)=>[E.partStart(p),E.partEnd(p)]);
(async()=>{
  let E=env(300,7);ok(E.partAt(0)===0&&E.segOffset===0&&E.partStart(1)===7,'begin: classic grid unchanged (0,7,14…)');
  E=env(300,7);let p=E.partAt(83);ok(E.partStart(p)===83&&E.partStart(p+1)===90&&E.partStart(p-1)===76&&E.partStart(0)===0,'83 s @ 7 s starts exactly 83 (not 77); next 90; prev 76; first part 0–6');
  ok(E.partEnd(0)===6&&E.partOf(83)===p&&E.partOf(82.9)===p-1,'boundaries consistent');
  E=env(300,7);p=E.partAt(84);ok(E.partStart(p)===84&&E.segOffset===0,'boundary multiple (84) keeps classic grid');
  E=env(100,7);p=E.partAt(95);let s=starts(E);ok(E.partStart(p)===95&&s[s.length-1][1]===100&&s[s.length-1][0]===95,'near end: last partial 95–100');
  E=env(100.5,7);p=E.partAt(93);s=starts(E);ok(s[s.length-1][0]===93&&s[s.length-1][1]===100,'tiny remainder (<1 s) skipped as before: last '+s[s.length-1]);
  E=env(100,7);p=E.partAt(99);ok(p===E.parts-1&&E.partStart(p)===99&&E.partEnd(p)===100,'slider max (d-1=99) gives last 1 s part');
  E=env(100,7);p=E.partAt(99.5);ok(p===E.parts-1&&E.partStart(p)<=99.5&&E.partEnd(p)>E.partStart(p),'start inside skipped <1 s tail clamps to previous valid part ('+E.partStart(p)+'–'+E.partEnd(p)+')');
  // coverage: parts tile whole audio without gaps/overlap
  for(const [d,L,t] of [[300,7,83],[3600*3,30,7777],[61,5,13],[10,30,4]]){E=env(d,L);E.partAt(t);s=starts(E);let c=0,good=true;for(const [a,b] of s){if(Math.abs(a-c)>1e-9||b<=a)good=false;c=b}ok(good&&d-c<1-1e-9,`tiling ok d=${d} L=${L} t=${t} parts=${E.parts}`)}
  // playSource seeks exactly to 83, final partial segLen
  E=env(300,7);E.currentPart=E.partAt(83);await E.playSource(1);ok(E.seeks.includes(83)&&E.segLen===7,'playSource plays from 83 for 7 s');
  E=env(100,7);E.currentPart=E.partAt(95);await E.playSource(1);ok(E.seeks.includes(95)&&E.segLen===5,'final partial segment 5 s');
  // cancellation guard still in playSource
  E=env(300,7);E.currentPart=E.partAt(83);E.stage=async()=>{E.stageToken++;return true};let pauses=0;E.sourceAudio.pause=()=>pauses++;const rr=await E.playSource(1);ok(rr===false&&pauses===1,'cancel guard: old round returns false, no pause after await');
  // length change during session keeps exact position
  E=env(300,7);E.currentPart=E.partAt(83);E.sessionActive=true;E.running=true;E.changeSeg(10,true);ok(E.partStart(E.currentPart)===83&&E.partStart(E.currentPart+1)===93&&E.restarted,'length 7→10 while training keeps 83, next 93, restarts round');
  E=env(300,7);E.currentPart=E.partAt(83);E.sessionActive=true;E.changeSeg(5);ok(E.partStart(E.currentPart)===83,'length change while idle keeps 83');
  // resume from saved pos (savePos stores partStart values) → identical
  E=env(300,7);E.currentPart=E.partAt(83);const saved=E.partStart(E.currentPart+2);let E2=env(300,7);ok(E2.partStart(E2.partAt(saved))===saved,'resume from saved pos '+saved+' exact');
  // new file resets offset (static: setSource sets segOffset=0)
  ok(/sourceDuration=0;segOffset=0;/.test(js),'loading new source resets segOffset');
  ok(/posDrag/.test(js)&&/startTraining\(partAt\(\+\$\('r_pos'\)\.value\)\)/.test(js)&&/Ab welcher Stelle üben\?/.test(html),'slider + Ab hier trainieren wired');
  ok(!/currentPart\*SEGMENT_SECONDS/.test(js),'no remaining classic grid computations');
  console.log('ALL PASS');
})().catch(e=>{console.error(e.message);process.exit(1)});
