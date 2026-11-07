// node echo-sprechzeit-test.js <index.html> : tests stage() finish/count-up/cancel/cap + recDone guard + settings defaults
const fs=require('fs'),html=fs.readFileSync(process.argv[2],'utf8');
const js=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');new Function(js);
const grab=n=>{const i=js.indexOf(n);if(i<0)throw Error('missing '+n);let d=0,j=js.indexOf('{',i);for(let k=j;;k++){if(js[k]=='{')d++;if(js[k]=='}'&&--d==0)return js.slice(i,k+1)}};
const el=()=>({textContent:'',style:{},classList:{toggle(){}}});const els={};
const E={stageToken:1,paused:false,running:true,performance:{now:()=>Date.now()},setTimeout,setStage(){},setTimer(){},$:id=>els[id]||(els[id]=el()),setPaused(p){E.paused=p}};
new Function('E',`with(E){E.stage=${grab('function stage').replace('function stage','function')};E.recDone=${grab('function recDone').replace('function recDone','function')}}`)(E);
const ok=(c,m)=>{if(!c)throw Error(m);console.log('ok',m)};
(async()=>{
  let sig={up:true,finish:false};setTimeout(()=>{E.recDoneSig=sig;E.recDone()},350);
  // recDone reads recDoneSig from E scope
  let r=await E.stage(120000,1,'x',sig);ok(r===true&&sig.elapsed>0.2&&sig.elapsed<1,'Fertig ends unlimited recording, elapsed '+sig.elapsed.toFixed(2));
  ok(/\d+ s/.test(els.timer.textContent),'count-up timer shown: '+els.timer.textContent);
  sig={up:true};setTimeout(()=>E.stageToken++,250);r=await E.stage(120000,1,'x',sig);ok(r===false,'cancel/new round aborts unlimited recording');
  sig={up:true};E.paused=true;E.recDoneSig=sig;E.running=true;setTimeout(()=>E.recDone(),200);r=await E.stage(5000,E.stageToken,'x',sig);ok(r===true&&!E.paused,'Fertig while paused resumes + finishes');
  sig={up:true};r=await E.stage(300,E.stageToken,'x',sig);ok(r===true,'safety cap ends recording normally');
  E.recDoneSig=null;E.recDone();ok(true,'recDone without active recording is a no-op');
  ok(/recFree:false/.test(js)&&/FREE_REC_MAX_SECONDS=120/.test(js),'default timed (recFree false), cap 120 s');
  ok(/function cancelRound\(\)\{recDoneSig=null;showRecDone\(false\)/.test(js),'cancelRound hides Fertig and drops signal');
  console.log('ALL PASS');
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
