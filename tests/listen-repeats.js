// Standalone check: JS syntax + playSource repeat/cancel logic + clamp/persist. Run: node validate.js <index.html>
const fs=require('fs'),html=fs.readFileSync(process.argv[2],'utf8');
const scripts=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for(const s of scripts) new Function(s); console.log('syntax ok,',scripts.length,'inline scripts');
const js=scripts.join('\n');
const grab=n=>{const i=js.indexOf(n);let d=0,j=js.indexOf('{',i);for(let k=j;;k++){if(js[k]=='{')d++;if(js[k]=='}'&&--d==0)return js.slice(i,k+1)}};
const src=grab('function clampListen')+'\n'+grab('async function playSource');
async function run(n,cancelAt){
  let plays=0,stageToken=1,ctx={};
  const env={S:{listen:n},SEGMENT_SECONDS:5,sourceDuration:12,currentPart:2,segLen:0,stageToken,canRecord:true,CAP_TEXT:'',activeCtl:null};
  const f=new Function('E',`with(E){${src.replace('async function playSource','E.playSource=async function')};}`);
  env.$=()=>({set textContent(v){}});env.setStatus=()=>{};env.finish=()=>{};env.elCtl=()=>({});
  env.sourceAudio={pause(){},set currentTime(v){env.lastSeek=v}};
  env.playMedia=()=>{plays++;if(plays===cancelAt)env.stageToken++};
  env.stage=async(ms,t)=>t===env.stageToken;
  f(env);const ok=await env.playSource(1);return{ok,plays,seg:env.segLen,seek:env.lastSeek};
}
(async()=>{
  for(const n of [1,3,10]){const r=await run(n);if(!r.ok||r.plays!==n)throw Error('repeat '+n);console.log('repeat',n,'→ plays',r.plays,'final partial segLen',r.seg,'seek',r.seek)}
  const c=await run(5,2);if(c.ok||c.plays!==2)throw Error('cancel');console.log('cancel at play 2 → stopped, plays',c.plays);
  const E={};new Function('E',`with(E){${grab('function clampListen').replace('function clampListen','E.c=function')}}`)(E);
  for(const [i,o] of [[0,1],[undefined,1],[11,10],['3',3],[NaN,1]]) if(E.c(i)!==o) throw Error('clamp '+i);
  console.log('clamp ok; persistence: S.listen saved via saveSettings() into echo.settings:',/S\.listen=clampListen\(v\);saveSettings\(\)/.test(js));
  console.log('ALL PASS');
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
