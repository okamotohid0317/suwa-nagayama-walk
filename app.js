'use strict';
const $=id=>document.getElementById(id), rad=Math.PI/180, maxLat=85.05112878;
let spots=[],selected=null,center={lat:35.6295,lng:139.449},zoom=15,current=null,watch=null,playing=null,spoken=new Set(),mapEpoch=0,cartoKey='';
try{cartoKey=sessionStorage.getItem('suwa-public-carto-key')||''}catch{}$('cartoKey').value=cartoKey;
const say=t=>{$('status').textContent=t};
function world(lat,lng,z){lat=Math.max(-maxLat,Math.min(maxLat,lat));let n=256*2**z;return{x:(lng+180)/360*n,y:(1-Math.log(Math.tan(lat*rad)+1/Math.cos(lat*rad))/Math.PI)/2*n}}
function latlng(x,y,z){let n=256*2**z;return{lng:x/n*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*y/n)))/rad}}
function screen(lat,lng){let c=world(center.lat,center.lng,zoom),p=world(lat,lng,zoom),m=$('map');return{x:m.clientWidth/2+p.x-c.x,y:m.clientHeight/2+p.y-c.y}}
function draw(){let tiles=$('tiles'),overlay=$('overlay');tiles.replaceChildren();overlay.replaceChildren();let seq=++mapEpoch,m=$('map'),w=m.clientWidth,h=m.clientHeight,c=world(center.lat,center.lng,zoom),minX=Math.floor((c.x-w/2)/256),maxX=Math.ceil((c.x+w/2)/256),minY=Math.floor((c.y-h/2)/256),maxY=Math.ceil((c.y+h/2)/256),n=2**zoom;
 if(cartoKey){let failures=0,successes=0;for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){if(y<0||y>=n)continue;let im=document.createElement('img');im.alt='';im.decoding='async';im.loading='eager';im.style.left=(x*256-c.x+w/2)+'px';im.style.top=(y*256-c.y+h/2)+'px';im.onload=()=>{if(seq===mapEpoch)successes++};im.onerror=()=>{if(seq===mapEpoch&&++failures>=3&&successes===0)say('地図画像が読み込めません。CARTO APIキーや接続状況をご確認ください。')};im.src=`https://basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${((x%n)+n)%n}/${y}.png?key=${encodeURIComponent(cartoKey)}`;tiles.append(im)}}else{let hint=document.createElement('div');hint.style.cssText='position:absolute;top:40%;left:10%;width:80%;padding:14px;background:#fffe;border-radius:8px;text-align:center';hint.textContent='背景地図を表示するには下の「CARTO APIキー」を入力してください。地点番号は表示されています。';tiles.append(hint)}
 spots.forEach((s,i)=>{let p=screen(s.lat,s.lng),b=document.createElement('button');b.className='pin'+(s.id===selected?' active':'');b.style.left=p.x+'px';b.style.top=p.y+'px';b.textContent=String(i+1);b.title=s.name;b.onclick=e=>{e.stopPropagation();choose(s.id)};overlay.append(b)});if(current){let p=screen(current.lat,current.lng),b=document.createElement('span');b.className='pin current';b.style.left=p.x+'px';b.style.top=p.y+'px';overlay.append(b)}}
function active(){return spots.find(s=>s.id===selected)}
function choose(id,pan=false){selected=id;let s=active();if(!s)return;if(pan)center={lat:s.lat,lng:s.lng};$('spotTitle').textContent=s.name;$('description').textContent=s.description||'';let photos=$('photos');photos.replaceChildren();(s.photos||[]).forEach((url,i)=>{let im=document.createElement('img');im.src=url;im.loading='lazy';im.alt=`${s.name} 写真${i+1}`;im.onclick=()=>window.open(url,'_blank','noopener');photos.append(im)});document.querySelectorAll('#spots button').forEach(b=>{b.classList.toggle('selected',b.dataset.id===id)});draw()}
function stopAudio(){if(playing){playing.pause();playing.currentTime=0;playing=null}if('speechSynthesis'in window)speechSynthesis.cancel()}
function speak(s){stopAudio();if(!('speechSynthesis'in window)){say('このブラウザでは自動読み上げが使えません。');return}let u=new SpeechSynthesisUtterance(s.description||s.name);u.lang='ja-JP';u.rate=.94;u.onstart=()=>say('音声ガイド再生中：'+s.name);u.onend=()=>say('音声ガイド終了：'+s.name);u.onerror=()=>say('音声の自動再生が制限されました。「解説を再生」を押してください。');speechSynthesis.speak(u)}
function playGuide(s){
 stopAudio();
 if(!s.audio){speak(s);return Promise.resolve(false)}
 const audio=new Audio(s.audio);
 audio.preload='auto';
 playing=audio;
 audio.onplaying=()=>say('録音音声を再生中：'+s.name);
 audio.onended=()=>{if(playing===audio)playing=null;say('音声ガイド終了：'+s.name)};
 audio.onerror=()=>{if(playing===audio){playing=null;say('録音音声を読み込めませんでした。通信環境を確認してください。')}};
 return audio.play().then(()=>true).catch(()=>{
   if(playing===audio){playing=null;say('音声の自動再生が制限されました。「解説を再生」を押してください。')}
   return false;
 });
}
function distance(a,b,c,d){let x=(c-a)*rad,y=(d-b)*rad,q=Math.sin(x/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(y/2)**2;return 12742000*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))}
function position(p){let {latitude:lat,longitude:lng,accuracy:acc}=p.coords;current={lat,lng};draw();let nearest=spots.map(s=>({s,d:distance(lat,lng,s.lat,s.lng)})).sort((a,b)=>a.d-b.d)[0];if(!nearest)return;say(`GPS精度：約±${Math.round(acc)}m／最寄り：${nearest.s.name}（約${Math.round(nearest.d)}m）`);let r=Number($('radius').value);if($('auto').checked&&acc<=80&&nearest.d<=r&&!spoken.has(nearest.s.id)){spoken.add(nearest.s.id);choose(nearest.s.id);playGuide(nearest.s)}}
function render(){let el=$('spots');el.replaceChildren();$('count').textContent=`（${spots.length}地点）`;spots.forEach((s,i)=>{let b=document.createElement('button');b.dataset.id=s.id;b.textContent=s.name;b.onclick=()=>choose(s.id,true);el.append(b)});if(spots.length)choose(spots[0].id)}
$('applyKey').onclick=()=>{cartoKey=$('cartoKey').value.trim();try{if(cartoKey)sessionStorage.setItem('suwa-public-carto-key',cartoKey);else sessionStorage.removeItem('suwa-public-carto-key')}catch{}draw();say(cartoKey?'背景地図を読み込み中です。':'APIキーが空欄です。')};
$('start').onclick=()=>{if(!navigator.geolocation){say('GPSが利用できません。HTTPSで公開したページを開いてください。');return}spoken.clear();if(watch!==null)navigator.geolocation.clearWatch(watch);watch=navigator.geolocation.watchPosition(position,e=>say('位置情報を取得できません：'+e.message+'。HTTPSと位置情報の許可を確認してください。'),{enableHighAccuracy:true,maximumAge:3000,timeout:20000});$('start').disabled=true;$('stop').disabled=false;say('GPS取得中です。端末の位置情報利用を許可してください。')};
$('stop').onclick=()=>{if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;$('start').disabled=false;$('stop').disabled=true;stopAudio();say('GPSガイドを停止しました。')};
$('replay').onclick=$('playDetail').onclick=()=>{let s=active();if(s)playGuide(s)};$('halt').onclick=()=>{stopAudio();say('音声を停止しました。')};
$('locate').onclick=()=>{if(!current){say('まずGPSガイドを開始してください。');return}center={lat:current.lat,lng:current.lng};zoom=17;draw()};$('zoomIn').onclick=()=>{zoom=Math.min(18,zoom+1);draw()};$('zoomOut').onclick=()=>{zoom=Math.max(11,zoom-1);draw()};
let drag=null;const map=$('map');map.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;drag={x:e.clientX,y:e.clientY,c:world(center.lat,center.lng,zoom)};map.setPointerCapture(e.pointerId)});map.addEventListener('pointermove',e=>{if(!drag)return;center=latlng(drag.c.x-(e.clientX-drag.x),drag.c.y-(e.clientY-drag.y),zoom);draw()});map.addEventListener('pointerup',()=>drag=null);map.addEventListener('pointercancel',()=>drag=null);map.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(11,Math.min(18,zoom+(e.deltaY<0?1:-1)));draw()},{passive:false});window.addEventListener('resize',draw);
fetch('spots.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(data=>{spots=data;render();say(`${spots.length}地点のデータと写真を読み込みました。地点を選ぶと録音音声を再生できます。`)}).catch(e=>say('地点データの読込に失敗しました。公開URL（HTTPS）で開いてください：'+e.message));
