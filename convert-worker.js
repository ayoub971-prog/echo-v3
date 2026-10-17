/* Echo – MP3-Encoder im Hintergrund (lamejs, lokal gebündelt, LGPL). Nimmt 16-Bit-Mono-Stücke an und gibt MP3-Bytes zurück. */
importScripts('lame.min.js');
var enc=null;
onmessage=function(e){
  var m=e.data;
  try{
    if(m.cmd==='init'){enc=new lamejs.Mp3Encoder(1,m.sr,m.kbps);postMessage({id:m.id,ok:true});return}
    if(m.cmd==='pcm'){
      var pcm=m.pcm,out=[],n=0,B=1152*20;
      for(var i=0;i<pcm.length;i+=B){var b=enc.encodeBuffer(pcm.subarray(i,Math.min(pcm.length,i+B)));if(b.length){out.push(new Uint8Array(b.buffer,b.byteOffset,b.length).slice());n+=b.length}}
      var u=new Uint8Array(n),o=0;for(var k=0;k<out.length;k++){u.set(out[k],o);o+=out[k].length}
      postMessage({id:m.id,ok:true,mp3:u},[u.buffer]);return}
    if(m.cmd==='flush'){var f=enc.flush();var v=new Uint8Array(f.buffer,f.byteOffset,f.length).slice();postMessage({id:m.id,ok:true,mp3:v},[v.buffer]);return}
  }catch(err){postMessage({id:m.id,ok:false,error:String(err&&err.message||err)})}
};
