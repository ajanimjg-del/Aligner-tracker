import {KEY,dayKey,dayBounds,totals,duration,validate} from './core.mjs';
const $=id=>document.getElementById(id);
let state,raw,blocked=false;
const fresh=()=>({version:1,startedAt:Date.now(),goalHours:22,breaks:[]});
function message(t){$('message').textContent=t;}
try{raw=localStorage.getItem(KEY);state=raw?validate(JSON.parse(raw)):fresh();if(!raw){raw=JSON.stringify(state);localStorage.setItem(KEY,raw);}}
catch(e){state=fresh();blocked=true;$('storageWarning').hidden=false;$('storageWarning').textContent='Saved data could not be loaded or storage is unavailable. Tracking is paused to protect your data. Export a recovery copy before troubleshooting.';}
function commit(next){
  if(blocked)throw Error('Tracking is paused because saved data could not be loaded.');
  const current=localStorage.getItem(KEY);
  if(current!==raw){if(current){state=validate(JSON.parse(current));raw=current;render();}throw Error('Data changed in another window. Please try your action again.');}
  const clean=validate(next),text=JSON.stringify(clean);
  localStorage.setItem(KEY,text);state=clean;raw=text;render();
}
function act(fn){try{fn();}catch(e){message(e.message);}}
function localInput(t){const d=new Date(t);return `${dayKey(t)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;}
function parseInput(s){if(!s)return null;const t=new Date(s).getTime();if(!Number.isFinite(t)||localInput(t).slice(0,s.length)!==s)throw Error('That local time does not exist. Check the date and clock change.');return t;}
function active(){return state.breaks.find(b=>b.end===null);}
$('day').value=dayKey(Date.now());$('goal').value=state.goalHours;
let lastToday=dayKey(Date.now());
function tick(){const now=Date.now(),today=dayKey(now);if(today!==lastToday){if($('day').value===lastToday)$('day').value=today;lastToday=today;renderHistory();}const b=active(),t=totals(state,today,now),selected=totals(state,$('day').value||today,now);
  $('timer').textContent=duration(b?now-b.start:t.wear);$('timerLabel').textContent=b?'Current break':'Wear time tracked today';$('status').textContent=b?'Aligners out':'Aligners in';$('toggle').textContent=b?'Put aligners back in':'Take aligners out';document.querySelector('.timer').classList.toggle('is-out',!!b);
  $('wear').textContent=duration(selected.wear);$('out').textContent=duration(selected.out);$('goalText').textContent=`${state.goalHours} h`;$('progress').value=Math.min(100,selected.wear/(state.goalHours*3600000)*100);
  $('coverage').textContent=`${duration(selected.tracked)} tracked on this day. Untracked time is not counted as wear. Times use this device’s local timezone.`;
  document.title=b?`${duration(now-b.start)} out · Aligner Tracker`:'Aligner Tracker';$('toggle').disabled=blocked;
}
function renderHistory(){const [lo,hi]=dayBounds($('day').value||dayKey(Date.now()));const rows=state.breaks.filter(b=>b.start<hi&&(b.end??Date.now())>lo).slice().reverse();$('history').replaceChildren();
  if(!rows.length){const p=document.createElement('p');p.className='muted';p.textContent='No breaks recorded for this day.';$('history').append(p);}
  for(const b of rows){const row=document.createElement('div');row.className='break-row';const info=document.createElement('div'),title=document.createElement('p'),detail=document.createElement('small'),button=document.createElement('button');title.textContent=b.note||'Aligner break';detail.textContent=`${new Date(b.start).toLocaleString()} → ${b.end?new Date(b.end).toLocaleString():'Ongoing'}`;info.append(title,detail);button.textContent='Edit';button.setAttribute('aria-label',`Edit break starting ${new Date(b.start).toLocaleString()}`);button.onclick=()=>edit(b);row.append(info,button);$('history').append(row);}
}
function render(){tick();renderHistory();}
$('toggle').onclick=()=>act(()=>{const b=active(),now=Date.now();commit({...state,breaks:b?state.breaks.map(x=>x.id===b.id?{...x,end:now}:x):[...state.breaks,{id:crypto.randomUUID(),start:now,end:null,note:''}]});});
$('day').onchange=render;
function edit(b){$('editId').value=b?.id||'';$('start').value=localInput(b?.start??Date.now()-60000);$('end').value=b?(b.end?localInput(b.end):''):localInput(Date.now());$('note').value=b?.note||'';$('delete').hidden=!b;$('editTitle').textContent=b?'Edit break':'Add a missed break';$('editError').textContent='';$('editor').showModal();}
$('add').onclick=()=>edit();$('cancel').onclick=()=>$('editor').close();
$('editForm').onsubmit=e=>{e.preventDefault();try{const b={id:$('editId').value||crypto.randomUUID(),start:parseInput($('start').value),end:parseInput($('end').value),note:$('note').value.trim()};const startedAt=Math.min(state.startedAt,b.start);commit({...state,startedAt,breaks:[...state.breaks.filter(x=>x.id!==b.id),b]});$('editor').close();}catch(e){$('editError').textContent=e.message;}};
$('delete').onclick=()=>{if(confirm('Delete this break? Its time will count as aligner wear.'))act(()=>{commit({...state,breaks:state.breaks.filter(b=>b.id!==$('editId').value)});$('editor').close();});};
$('settings').onsubmit=e=>{e.preventDefault();act(()=>{commit({...state,goalHours:Number($('goal').value)});message('Daily goal saved.');});};
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>act(()=>{const saved=localStorage.getItem(KEY);download(blocked?(saved??'{}'):JSON.stringify({app:'aligner-tracker',exportedAt:new Date().toISOString(),data:state},null,2),`aligner-tracker-${dayKey(Date.now())}${blocked?'-recovery':''}.json`);message('Backup download requested. Keep the file somewhere safe.');});
$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{try{const file=$('file').files[0];if(!file)return;if(file.size>10000000)throw Error('Backup is too large (maximum 10 MB).');const parsed=JSON.parse(await file.text());if(parsed.app!=='aligner-tracker')throw Error('This backup format is not recognised. Keep the original file so it can be migrated safely.');const next=validate(parsed.data);if(confirm(`Replace all current data with ${next.breaks.length} breaks from this backup? Export your current data first if you need to keep it.`)){commit(next);$('goal').value=state.goalHours;message('Backup imported.');}}catch(e){message(e.message);}finally{$('file').value='';}};
window.addEventListener('storage',e=>{if(e.key===KEY){try{if(!e.newValue)throw Error('Saved data was removed in another window. Reload before tracking.');state=validate(JSON.parse(e.newValue));raw=e.newValue;$('goal').value=state.goalHours;render();}catch(e){blocked=true;message(e.message);tick();}}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});setInterval(tick,1000);render();
let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install').hidden=false;});$('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('install').hidden=true;}};window.addEventListener('appinstalled',()=>{$('install').hidden=true;});
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').then(async reg=>{await navigator.serviceWorker.ready;$('offline').textContent='Offline access is ready on this device.';reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)message('An app update is ready. Close all tracker windows and reopen to use it. Your data stays saved.');});});}).catch(()=>{$('offline').textContent='Offline access could not be prepared. Open the published HTTPS site and try again.';});}else{$('offline').textContent='Offline installation is not supported in this browser.';}
