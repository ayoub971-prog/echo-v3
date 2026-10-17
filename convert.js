/* Echo – Umwandlung im Browser: Audio oder Video -> kleines MP3 (Mono, 22,05 kHz, 48 kbit/s).
   Alles stückweise (ca. 60 s pro Stück), damit auch 1-2 Stunden lange Dateien den iPhone-Speicher nicht sprengen.
   Wege: WAV direkt lesen · MP3/AAC-Frames zerlegen · MP4/MOV/M4A (Videos, Sprachmemos) Tonspur herauslösen.
   Dekodiert wird mit decodeAudioData, kodiert mit lamejs in einem Web Worker. */
(function(){
'use strict';
var OUT_SR=22050,KBPS=48,CHUNK_SEC=60,OVERLAP=3,WHOLE_MAX=30*1024*1024;
function Cancelled(){var e=new Error('Abgebrochen');e.name='Cancelled';return e}
function rd(file,a,b){return file.slice(a,b).arrayBuffer().then(function(x){return new Uint8Array(x)})}
function s4(u,o){return String.fromCharCode(u[o],u[o+1],u[o+2],u[o+3])}
function be32(u,o){return((u[o]<<24)>>>0)+(u[o+1]<<16)+(u[o+2]<<8)+u[o+3]}
function concat(list,total){var u=new Uint8Array(total),o=0;for(var i=0;i<list.length;i++){u.set(list[i],o);o+=list[i].length}return u}
function sumLen(list){var n=0;for(var i=0;i<list.length;i++)n+=list[i].length;return n}

async function sniff(file){
  var h=await rd(file,0,Math.min(file.size,64));
  if(h.length>=12&&s4(h,0)==='RIFF'&&s4(h,8)==='WAVE')return'wav';
  if(h.length>=8&&/^(ftyp|moov|mdat|wide|free|skip|pnot|uuid)$/.test(s4(h,4)))return'mp4';
  if(h.length>=4&&(s4(h,0)==='OggS'||s4(h,0)==='fLaC'||s4(h,0)==='caff'||(h[0]===0x1A&&h[1]===0x45)))return'other';
  if(h.length>=3&&h[0]===0x49&&h[1]===0x44&&h[2]===0x33)return'frames';
  if(h.length>=2&&h[0]===0xFF&&(h[1]&0xE0)===0xE0)return'frames';
  return'other';
}

/* ---------- Dekodieren ---------- */
var dctx=null,dctxSr=0;
function decCtx(){
  if(dctx)return dctx;
  var C=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!C)throw new Error('Dieser Browser kann Audio nicht umwandeln');
  try{dctx=new C(1,1,OUT_SR);dctxSr=OUT_SR}catch(e){dctx=new C(1,1,44100);dctxSr=44100}
  return dctx;
}
function decode(u8){
  var c=decCtx(),ab=u8.buffer.byteLength===u8.length&&u8.byteOffset===0?u8.buffer:u8.slice().buffer;
  return new Promise(function(res,rej){var p;try{p=c.decodeAudioData(ab,res,function(e){rej(e||new Error('Dekodierung fehlgeschlagen'))})}catch(e){rej(e);return}if(p&&p.catch)p.catch(rej)});
}
function mono(buf){
  var n=buf.length,ch=buf.numberOfChannels;if(ch===1)return buf.getChannelData(0);
  var out=new Float32Array(n),i,k,d;
  for(k=0;k<ch;k++){d=buf.getChannelData(k);for(i=0;i<n;i++)out[i]+=d[i]}
  var g=1/ch;for(i=0;i<n;i++)out[i]*=g;return out;
}
async function decodeFrames(frames,ov){
  var u=concat(frames,sumLen(frames));var buf=await decode(u);u=null;
  var m=mono(buf),drop=ov?Math.round(m.length*ov/frames.length):0;
  return{data:drop?m.subarray(drop):m,sr:buf.sampleRate};
}

/* ---------- Abtastrate anpassen (stückweise, mit Zustand) ---------- */
function makeResampler(inSr,outSr){
  if(Math.abs(inSr-outSr)<1)return function(x){return x};
  var step=inSr/outSr,t=0,last=0,lp=0,a=step>1.2?1-Math.exp(-2*Math.PI*(outSr*0.42)/inSr):0;
  return function(x){
    var n=x.length,i;if(!n)return x;
    if(a){var y=new Float32Array(n);for(i=0;i<n;i++){lp+=a*(x[i]-lp);y[i]=lp}x=y}
    var outN=Math.max(0,Math.ceil((n-1-t)/step)),out=new Float32Array(outN),k=0;
    while(t<n-1&&k<outN){i=Math.floor(t);var f=t-i,v0=i<0?last:x[i],v1=x[i+1];out[k++]=v0+(v1-v0)*f;t+=step}
    t-=n;last=x[n-1];return k===outN?out:out.subarray(0,k);
  };
}

/* ---------- MP3- und AAC(ADTS)-Frames ---------- */
var BR={v1l3:[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320],v1l2:[0,32,48,56,64,80,96,112,128,160,192,224,256,320,384],v2:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160]};
var AAC_SR=[96000,88200,64000,48000,44100,32000,24000,22050,16000,12000,11025,8000,7350];
function frameAt(u,i){
  if(i+7>u.length||u[i]!==0xFF)return null;var b1=u[i+1];
  if((b1&0xF6)===0xF0){ // ADTS (AAC)
    var len=((u[i+3]&3)<<11)|(u[i+4]<<3)|(u[i+5]>>5),sri=(u[i+2]>>2)&15;
    if(len<7||sri>12)return null;return{len:len,spf:1024*(1+(u[i+6]&3)),sr:AAC_SR[sri],t:'aac'};
  }
  if((b1&0xE0)!==0xE0)return null;
  var ver=(b1>>3)&3,layer=(b1>>1)&3,b2=u[i+2],bri=b2>>4,sri2=(b2>>2)&3,pad=(b2>>1)&1;
  if(ver===1||layer===0||layer===3||bri===0||bri===15||sri2===3)return null; // Layer I wird nicht unterstützt
  var v1=ver===3,sr=[44100,48000,32000][sri2]/(v1?1:ver===2?2:4);
  var br=(v1?(layer===1?BR.v1l3:BR.v1l2):BR.v2)[bri]*1000;
  var spf=layer===2?1152:(v1?1152:576),L=Math.floor(spf/8*br/sr)+pad;
  return{len:L,spf:spf,sr:sr,t:'mp3'};
}
async function* frameSource(file,sig){
  var pos=0,buf=new Uint8Array(0),eof=false,READ=2*1024*1024,chunk=[],prev=[],samples=0,first=null,skipped=0;
  var head=await rd(file,0,Math.min(file.size,10));
  if(head.length>=10&&head[0]===0x49&&head[1]===0x44&&head[2]===0x33){pos=10+((head[6]&127)<<21|(head[7]&127)<<14|(head[8]&127)<<7|(head[9]&127))+((head[5]&16)?10:0)}
  var fileOff=pos;buf=new Uint8Array(0);var bi=0;
  async function more(){if(fileOff>=file.size){eof=true;return false}var nx=await rd(file,fileOff,Math.min(file.size,fileOff+READ));fileOff+=nx.length;var rest=buf.subarray(bi);var u=new Uint8Array(rest.length+nx.length);u.set(rest,0);u.set(nx,rest.length);buf=u;bi=0;return true}
  while(true){
    if(sig&&sig.cancelled)throw Cancelled();
    if(bi+8>buf.length&&!eof){await more();continue}
    if(bi+8>buf.length)break;
    var f=frameAt(buf,bi);
    if(f&&first&&(f.t!==first.t||f.sr!==first.sr))f=null;
    if(f&&bi+f.len>buf.length&&!eof){await more();continue}
    if(f&&bi+f.len>buf.length)break;
    if(f&&!first){ // erstes Frame: das nächste muss auch passen
      if(bi+f.len+8>buf.length&&!eof){await more();continue}
      var g=frameAt(buf,bi+f.len);if(!g||g.t!==f.t||g.sr!==f.sr)f=null;else first=f;
    }
    if(!f){bi++;skipped++;if(!first&&skipped>4*1024*1024)throw new Error('Keine Tonspur gefunden');continue}
    chunk.push(buf.subarray(bi,bi+f.len));samples+=f.spf;bi+=f.len;
    if(samples>=CHUNK_SEC*f.sr){
      var all=prev.concat(chunk),r=await decodeFrames(all,prev.length);
      prev=chunk.slice(-OVERLAP).map(function(x){return x.slice()});chunk=[];samples=0;
      r.progress=Math.min(0.999,(fileOff-(buf.length-bi))/file.size);yield r;
    }
  }
  if(!first)throw new Error('Keine Tonspur gefunden');
  if(chunk.length){var r2=await decodeFrames(prev.concat(chunk),prev.length);r2.progress=1;yield r2}
}

/* ---------- MP4 / MOV / M4A ---------- */
function boxes(u,s,e){var r=[],o=s;while(o+8<=e){var sz=be32(u,o),t=s4(u,o+4),h=8;if(sz===1){sz=be32(u,o+8)*4294967296+be32(u,o+12);h=16}else if(sz===0)sz=e-o;if(sz<h||o+sz>e)break;r.push({t:t,s:o+h,e:o+sz});o+=sz}return r}
function child(u,b,t){if(!b)return null;var l=boxes(u,b.s,b.e);for(var i=0;i<l.length;i++)if(l[i].t===t)return l[i];return null}
function descLen(u,o){var n=0,k=0;for(;k<4;k++){var b=u[o+k];n=(n<<7)|(b&127);if(!(b&128))break}return{n:n,h:k+1}}
function parseEsds(u,s,e){
  var o=s+4;if(u[o]!==3)return null;var d=descLen(u,o+1);o+=1+d.h+2;var fl=u[o++];if(fl&128)o+=2;if(fl&64)o+=1+u[o];if(fl&32)o+=2;
  if(u[o]!==4)return null;d=descLen(u,o+1);o+=1+d.h;var oti=u[o];o+=13;
  var asc=null;if(u[o]===5){d=descLen(u,o+1);asc=u.slice(o+1+d.h,o+1+d.h+d.n)}
  return{oti:oti,asc:asc};
}
async function mp4Info(file){
  var off=0,moov=null;
  while(off+8<=file.size){
    var h=await rd(file,off,Math.min(file.size,off+16)),sz=be32(h,0),t=s4(h,4),hd=8;
    if(sz===1){sz=be32(h,8)*4294967296+be32(h,12);hd=16}else if(sz===0)sz=file.size-off;
    if(sz<hd)break;
    if(t==='moov'){if(sz>300*1024*1024)throw new Error('Datei-Inhaltsverzeichnis zu gross');moov=await rd(file,off,off+sz);break}
    off+=sz;
  }
  if(!moov)throw new Error('Video/Audio-Inhaltsverzeichnis nicht gefunden');
  var u=moov,root={s:8,e:u.length},traks=boxes(u,root.s,root.e).filter(function(b){return b.t==='trak'}),why='Keine Tonspur gefunden';
  for(var ti=0;ti<traks.length;ti++){
    var mdia=child(u,traks[ti],'mdia'),hdlr=child(u,mdia,'hdlr');if(!hdlr||s4(u,hdlr.s+8)!=='soun')continue;
    var mdhd=child(u,mdia,'mdhd'),v=u[mdhd.s],ts=v===1?be32(u,mdhd.s+20):be32(u,mdhd.s+12);
    var stbl=child(u,child(u,mdia,'minf'),'stbl'),stsd=child(u,stbl,'stsd');if(!stsd)continue;
    var fmt=s4(u,stsd.s+12);
    if(fmt!=='mp4a'&&fmt!=='.mp3'&&fmt!=='mp3 '){why='Ton-Format „'+fmt.trim()+'“ wird nicht unterstützt';continue}
    var es=null;if(fmt==='mp4a'){for(var q=stsd.s+16;q+8<stsd.e;q++){if(u[q]===0x65&&s4(u,q)==='esds'){es=parseEsds(u,q+4,be32(u,q-4)+q-4);break}}}
    var kind=fmt==='mp4a'?(es&&(es.oti===0x6B||es.oti===0x69)?'mp3':'aac'):'mp3';
    if(kind==='aac'&&(!es||!es.asc||es.asc.length<2)){why='AAC-Konfiguration fehlt';continue}
    var stsz=child(u,stbl,'stsz'),n=be32(u,stsz.s+8),fix=be32(u,stsz.s+4),sizes=new Uint32Array(n),i;
    for(i=0;i<n;i++)sizes[i]=fix||be32(u,stsz.s+12+i*4);
    var co=child(u,stbl,'stco'),c64=!co;if(c64)co=child(u,stbl,'co64');var nc=be32(u,co.s+4),chunkOff=new Float64Array(nc);
    for(i=0;i<nc;i++)chunkOff[i]=c64?be32(u,co.s+8+i*8)*4294967296+be32(u,co.s+12+i*8):be32(u,co.s+8+i*4);
    var stsc=child(u,stbl,'stsc'),ne=be32(u,stsc.s+4),offs=new Float64Array(n),si=0;
    for(var en=0;en<ne;en++){
      var fc=be32(u,stsc.s+8+en*12)-1,spc=be32(u,stsc.s+12+en*12),lc=en+1<ne?be32(u,stsc.s+8+(en+1)*12)-1:nc;
      for(var c=fc;c<lc&&si<n;c++){var o=chunkOff[c];for(var k=0;k<spc&&si<n;k++){offs[si]=o;o+=sizes[si];si++}}
    }
    var stts=child(u,stbl,'stts'),dur=0;if(stts){var m=be32(u,stts.s+4);for(i=0;i<m;i++)dur+=be32(u,stts.s+8+i*8)*be32(u,stts.s+12+i*8)}
    var info={kind:kind,n:si,sizes:sizes,offs:offs,duration:ts?dur/ts:0,ts:ts};
    if(kind==='aac'){
      var a=es.asc,ot=a[0]>>3,sfi=((a[0]&7)<<1)|(a[1]>>7),ch=(a[1]>>3)&15;
      if(sfi===15){var r=AAC_SR.indexOf(ts);sfi=r>=0?r:4}
      info.prof=(ot>=1&&ot<=4?ot:2)-1;info.sfi=sfi;info.ch=ch||2;
    }
    return info;
  }
  throw new Error(why);
}
function adts(info,len){var L=len+7,h=new Uint8Array(L);h[0]=0xFF;h[1]=0xF1;h[2]=(info.prof<<6)|(info.sfi<<2)|((info.ch>>2)&1);h[3]=((info.ch&3)<<6)|((L>>11)&3);h[4]=(L>>3)&0xFF;h[5]=((L&7)<<5)|0x1F;h[6]=0xFC;return h}
async function readSamples(file,info,a,b){
  var out=[],i=a;
  while(i<b){ // zusammenhängende Läufe in einem Rutsch lesen (kleine Lücken mitlesen)
    var s=info.offs[i],e=s+info.sizes[i],j=i+1;
    while(j<b&&info.offs[j]>=e&&info.offs[j]-e<65536&&info.offs[j]+info.sizes[j]-s<8*1024*1024){e=info.offs[j]+info.sizes[j];j++}
    var u=await rd(file,s,e);
    for(var k=i;k<j;k++){var p=info.offs[k]-s,sz=info.sizes[k],raw=u.subarray(p,p+sz);
      if(info.kind==='aac'){var f=adts(info,sz);f.set(raw,7);out.push(f)}else out.push(raw.slice())}
    i=j;
  }
  return out;
}
async function* mp4Source(file,sig){
  var info=await mp4Info(file);if(!info.n)throw new Error('Keine Tonspur gefunden');
  var per=info.kind==='aac'?Math.ceil(CHUNK_SEC*(info.ts||44100)/1024):Math.ceil(CHUNK_SEC*(info.ts||44100)/1152);
  for(var i=0;i<info.n;i+=per){
    if(sig&&sig.cancelled)throw Cancelled();
    var a=Math.max(0,i-OVERLAP),b=Math.min(info.n,i+per);
    var frames=await readSamples(file,info,a,b),r=await decodeFrames(frames,i-a);frames=null;
    r.progress=b/info.n;yield r;
  }
}

/* ---------- WAV ---------- */
async function wavHeader(file){
  var h=await rd(file,0,Math.min(file.size,1024*1024)),o=12,fmt=null;
  while(o+8<=h.length){var id=s4(h,o),sz=(h[o+4]|h[o+5]<<8|h[o+6]<<16|h[o+7]<<24)>>>0;
    if(id==='fmt '){var dv=new DataView(h.buffer,o+8);fmt={tag:dv.getUint16(0,true),ch:dv.getUint16(2,true),sr:dv.getUint32(4,true),bits:dv.getUint16(14,true)};if(fmt.tag===0xFFFE&&sz>=26)fmt.tag=dv.getUint16(24,true)}
    else if(id==='data'){if(!fmt)break;var len=sz===0||sz===0xFFFFFFFF||o+8+sz>file.size?file.size-o-8:sz;return{fmt:fmt,off:o+8,len:len}}
    o+=8+sz+(sz&1)}
  return null;
}
async function* wavSource(file,sig){
  var w=await wavHeader(file);if(!w)throw new Error('WAV-Datei nicht lesbar');
  var f=w.fmt,bps=f.bits/8,fr=bps*f.ch;
  if(!((f.tag===1&&(f.bits===8||f.bits===16||f.bits===24||f.bits===32))||(f.tag===3&&f.bits===32))||!f.ch)throw new Error('WAV-Format wird nicht unterstützt');
  var step=Math.floor(10*f.sr)*fr,end=w.off+Math.floor(w.len/fr)*fr;
  for(var p=w.off;p<end;p+=step){
    if(sig&&sig.cancelled)throw Cancelled();
    var u=await rd(file,p,Math.min(end,p+step)),dv=new DataView(u.buffer),n=Math.floor(u.length/fr),out=new Float32Array(n);
    for(var i=0;i<n;i++){var s=0;for(var c=0;c<f.ch;c++){var q=i*fr+c*bps,v;
      if(f.tag===3)v=dv.getFloat32(q,true);else if(f.bits===16)v=dv.getInt16(q,true)/32768;else if(f.bits===24)v=((u[q]|u[q+1]<<8|u[q+2]<<16)<<8>>8)/8388608;else if(f.bits===32)v=dv.getInt32(q,true)/2147483648;else v=(u[q]-128)/128;
      s+=v}out[i]=s/f.ch}
    yield{data:out,sr:f.sr,progress:Math.min(1,(p+step-w.off)/(end-w.off))};
  }
}
/* ---------- Rest: ganze Datei auf einmal (nur kleinere Dateien) ---------- */
async function* wholeSource(file){
  if(file.size>WHOLE_MAX)throw new Error('Dieses Dateiformat kann Echo nur bis 30 MB umwandeln');
  var buf=await decode(await rd(file,0,file.size));var m=mono(buf),sr=buf.sampleRate;buf=null;
  for(var i=0;i<m.length;i+=sr*CHUNK_SEC)yield{data:m.subarray(i,Math.min(m.length,i+sr*CHUNK_SEC)),sr:sr,progress:Math.min(1,(i+sr*CHUNK_SEC)/m.length)};
}

/* ---------- MP3-Encoder (Worker, sonst im Hauptfaden) ---------- */
function loadLame(){return window.lamejs?Promise.resolve():new Promise(function(res,rej){var s=document.createElement('script');s.src='lame.min.js';s.onload=function(){res()};s.onerror=function(){rej(new Error('MP3-Encoder nicht geladen'))};document.head.appendChild(s)})}
async function makeEncoder(){
  var parts=[],w=null,seq=0,wait={};
  function call(msg,tr){return new Promise(function(res,rej){msg.id=++seq;wait[msg.id]={res:res,rej:rej};w.postMessage(msg,tr||[])})}
  try{
    w=new Worker('convert-worker.js');
    w.onmessage=function(e){var m=e.data,p=wait[m.id];if(!p)return;delete wait[m.id];m.ok?p.res(m):p.rej(new Error(m.error))};
    w.onerror=function(e){for(var k in wait){wait[k].rej(new Error('MP3-Encoder: '+(e.message||'Fehler')));delete wait[k]}};
    await Promise.race([call({cmd:'init',sr:OUT_SR,kbps:KBPS}),new Promise(function(_,rej){setTimeout(function(){rej(new Error('Worker antwortet nicht'))},8000)})]);
    return{
      encode:async function(f){var p=toI16(f),m=await call({cmd:'pcm',pcm:p},[p.buffer]);if(m.mp3&&m.mp3.length)parts.push(m.mp3)},
      finish:async function(){var m=await call({cmd:'flush'});if(m.mp3&&m.mp3.length)parts.push(m.mp3);return new Blob(parts,{type:'audio/mpeg'})},
      close:function(){try{w.terminate()}catch(e){}}
    };
  }catch(e){
    try{w&&w.terminate()}catch(_){}
    await loadLame();var enc=new window.lamejs.Mp3Encoder(1,OUT_SR,KBPS);
    return{
      encode:async function(f){var p=toI16(f);for(var i=0;i<p.length;i+=1152*40){var b=enc.encodeBuffer(p.subarray(i,i+1152*40));if(b.length)parts.push(new Uint8Array(b));await new Promise(function(r){setTimeout(r,0)})}},
      finish:async function(){var b=enc.flush();if(b.length)parts.push(new Uint8Array(b));return new Blob(parts,{type:'audio/mpeg'})},
      close:function(){}
    };
  }
}
function toI16(f){var p=new Int16Array(f.length);for(var i=0;i<f.length;i++){var x=f[i];p[i]=x>=1?32767:x<=-1?-32768:x*32767}return p}

/* ---------- Ablauf ---------- */
async function run(file,src,onProgress,sig){
  var enc=await makeEncoder(),out=0,rs=null,rsSr=0,peak=0;
  try{
    for await(var r of src){
      if(sig&&sig.cancelled)throw Cancelled();
      if(r.sr!==rsSr){rs=makeResampler(r.sr,OUT_SR);rsSr=r.sr}
      var y=rs(r.data);for(var i=0;i<y.length;i+=97){var a=Math.abs(y[i]);if(a>peak)peak=a}
      out+=y.length;await enc.encode(y);onProgress&&onProgress(Math.min(0.999,r.progress||0));
    }
    if(out<OUT_SR*0.3)throw new Error('Keine Tonspur gefunden');
    var blob=await enc.finish();onProgress&&onProgress(1);
    return{blob:blob,duration:out/OUT_SR,silent:peak<1e-4};
  }finally{enc.close()}
}
async function convert(file,opt){
  opt=opt||{};var sig=opt.signal||{},kind=await sniff(file),tried=[],lastErr=null;
  var order=kind==='wav'?['wav']:kind==='mp4'?['mp4','whole']:kind==='frames'?['frames','whole']:['whole'];
  for(var i=0;i<order.length;i++){
    var k=order[i];if(k==='whole'&&file.size>WHOLE_MAX&&tried.length)break;
    tried.push(k);
    try{
      var src=k==='wav'?wavSource(file,sig):k==='mp4'?mp4Source(file,sig):k==='frames'?frameSource(file,sig):wholeSource(file);
      var res=await run(file,src,opt.onProgress,sig);res.path=k;return res;
    }catch(e){if(e&&e.name==='Cancelled')throw e;lastErr=e}
  }
  throw lastErr||new Error('Umwandlung nicht möglich');
}
window.EchoConvert={convert:convert,OUT_SR:OUT_SR,KBPS:KBPS,_mp4Info:mp4Info,_sniff:sniff};
})();
