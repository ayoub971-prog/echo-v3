// node echo-race-test.js <index.html> : behavioral tests on real functions extracted from index.html (stubbed browser APIs)
const fs=require('fs'),html=fs.readFileSync(process.argv[2],'utf8');
const js=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');new Function(js);
const grab=n=>{const i=js.indexOf(n);if(i<0)throw Error('missing '+n);let d=0,j=js.indexOf('{',i);for(let k=j;;k++){if(js[k]=='{')d++;if(js[k]=='}'&&--d==0)return js.slice(i,k+1)}};
const ok=(c,m)=>{if(!c)throw Error('FAIL: '+m);console.log('ok',m)};
function env(){
  const E={stageToken:1,paused:false,running:true,S:{listen:3,recFree:true},SEGMENT_SECONDS:5,sourceDuration:20,currentPart:0,segLen:0,canRecord:true,CAP_TEXT:'',
    activeCtl:null,micBusy:false,micOwner:0,voiceHold:false,recorder:null,recTrack:null,recDoneSig:null,recVoiceOK:false,voiceEnabled:false,recNotice:'',holdTimer:null,micInfo:'',actx:null,
    pendingStages:[],btnShown:false,pauses:0,window:{},Blob,Math,Promise,setTimeout,clearTimeout};
  E.partStart=p=>p*E.SEGMENT_SECONDS;E.partEnd=p=>Math.min(E.sourceDuration,(p+1)*E.SEGMENT_SECONDS);// v13 grid helpers
  E.$=()=>({set textContent(v){},classList:{toggle(){}}});
  E.sourceAudio={pause(){E.pauses++},set currentTime(v){}};E.myPlayback={pause(){}};
  E.elCtl=el=>({el});E.playMedia=()=>{};E.setStatus=()=>{};E.setStage=()=>{};E.finish=()=>{};
  E.stage=(ms,t,title,sig)=>new Promise(res=>E.pendingStages.push({res,t,sig}));
  E.syncVoice=()=>{};E.stopRecognition=async()=>{};E.ensureMic=async()=>({getAudioTracks:()=>[{readyState:'live'}]});E.ensureTap=async()=>null;
  E.beepDone=async()=>{};E.vibrate=()=>{};E.sleep=async()=>{};E.pickMime=()=>'';E.recHint=()=>'';E.pcmLevel=()=>0;E.pcmToWav=()=>new Blob([]);
  E.showRecDone=on=>{E.btnShown=on};E.FREE_REC_MAX_SECONDS=120;E.MediaRecorder=undefined;
  const f=['function clampListen','async function playSource','async function replayOriginal','async function recordAttempt'].map(n=>{const g=grab(n),nm=g.match(/function (\w+)/)[1];return `E.${nm}=${g.replace(/^(async )?function \w+/,'$1function')};`}).join('\n');
  new Function('E',`with(E){${f}}`)(E);E.clampListen=E.clampListen;return E;
}
const tick=()=>new Promise(r=>setTimeout(r,5));
(async()=>{
  // 1) old playSource cancelled while in stage; new round owns audio; old resolve must not pause/clear
  let E=env();const p=E.playSource(1);await tick();
  E.stageToken=2;E.activeCtl={el:E.sourceAudio,owner:'new'};const before=E.pauses;
  E.pendingStages[0].res(false);ok((await p)===false,'old playSource returns false');
  ok(E.pauses===before&&E.activeCtl&&E.activeCtl.owner==='new','old playSource did not pause/clear newer round audio');
  // also when old stage resolves true after cancel (race)
  E=env();const p1=E.playSource(1);await tick();E.stageToken=2;E.activeCtl={owner:'new'};const b1=E.pauses;E.pendingStages[0].res(true);
  ok((await p1)===false&&E.pauses===b1&&E.activeCtl.owner==='new','old stage resolving true after cancel also ignored');
  // 2) repeats: 3 plays + 2 gaps then true
  E=env();let plays=0;E.playMedia=()=>plays++;const p2=E.playSource(1);for(let i=0;i<5;i++){await tick();E.pendingStages[i].res(true)}
  ok((await p2)===true&&plays===3,'listen=3 plays exactly 3 times');
  // 3) replayOriginal guard
  E=env();E.S.repeatOrig=true;const p3=E.replayOriginal(1);await tick();E.stageToken=2;E.activeCtl={owner:'new'};const b3=E.pauses;E.pendingStages[0].res(true);
  ok((await p3)===false&&E.pauses===b3&&E.activeCtl.owner==='new','old replayOriginal does not touch newer audio');
  // 4) recFree old recording cancelled; newer recording started → old cleanup keeps new button, recDoneSig, mic state, recorder
  E=env();const oldR=E.recordAttempt(1,null);await tick();ok(E.btnShown&&E.recDoneSig===E.pendingStages[0].sig,'free recording shows Fertig with its own signal');
  const oldSig=E.pendingStages[0].sig;
  E.stageToken=2;E.recDoneSig=null;E.btnShown=false;          // cancelRound effect
  const newR=E.recordAttempt(2,null);await tick();const newSig=E.pendingStages[1].sig;E.recorder={mine:'new'};E.recTrack={mine:'new'};
  ok(E.recDoneSig===newSig&&E.btnShown&&E.micBusy,'newer recording active');
  E.pendingStages[0].res(false);ok((await oldR).status==='cancel','old recording returns cancel');
  ok(E.btnShown&&E.recDoneSig===newSig,'old cleanup did not hide newer Fertig button / signal');
  ok(E.micBusy&&E.voiceHold&&E.micOwner===2,'old cleanup did not clear newer mic state');
  ok(E.recorder.mine==='new'&&E.recTrack.mine==='new','old cleanup did not null newer recorder/track');
  newSig.elapsed=7.4;newSig.finish=true;E.pendingStages[1].res(true);const nr=await newR;
  ok(!E.btnShown&&E.recDoneSig===null&&!E.micBusy&&!E.voiceHold,'own finish hides button and frees mic');
  ok(nr.status==='early','stubbed empty recorder -> early (retry path unchanged)');
  // 5) cancelled with no newer round: mic state released
  E=env();const r5=E.recordAttempt(1,null);await tick();E.stageToken=2;E.pendingStages[0].res(false);await r5;ok(!E.micBusy&&!E.voiceHold,'cancel without newer round frees mic state');
  // 6) static: labels honest, cap, defaults
  ok(!/ohne (zeit)?limit|so lange du willst/i.test(html),'no unlimited wording');
  ok(/Selbst beenden \(max\. 2 Minuten\)/.test(html)&&/FREE_REC_MAX_SECONDS=120/.test(js)&&/recSame:true,recFree:false/.test(js),'honest label, cap 120 s, default timed=Stück');
  console.log('ALL PASS');
})().catch(e=>{console.error(e.message);process.exit(1)});
