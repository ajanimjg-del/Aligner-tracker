import {KEY,dayKey,dayBounds,totals,duration,validate,saveBreak,dueReminder} from './core.mjs';
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
$('day').value=dayKey(Date.now());$('goal').value=Math.round((24-state.goalHours)*60);
let lastToday=dayKey(Date.now());
function tick(){const now=Date.now(),today=dayKey(now);if(today!==lastToday){if($('day').value===lastToday)$('day').value=today;lastToday=today;renderHistory();}const b=active(),t=totals(state,today,now),selected=totals(state,$('day').value||today,now);
  $('timer').textContent=duration(b?now-b.start:t.out);$('timerLabel').textContent=b?'BREAK RUNNING · Time out':'Today’s time out';$('status').textContent=b?'Aligners out':'Aligners in';$('toggle').textContent=b?'Put aligners back in':'Take aligners out';document.querySelector('.timer').classList.toggle('is-out',!!b);
  const allowance=(24-state.goalHours)*3600000; $('wear').textContent=selected.out>allowance?`${duration(selected.out-allowance)} over`:duration(allowance-selected.out);$('out').textContent=duration(selected.out);$('goalText').textContent=`${Math.round((24-state.goalHours)*60)} min`;$('progress').value=allowance?Math.min(100,selected.out/allowance*100):(selected.out?100:0);
  $('coverage').textContent='Only recorded breaks count. Overnight breaks are split at local midnight.';
  $('todaySummary').textContent=`Today: ${duration(t.out)} out · ${t.out>allowance?`${duration(t.out-allowance)} over allowance`:`${duration(allowance-t.out)} left`}`;
  checkReminders(b,now);
  document.title=b?`${duration(now-b.start)} out · Aligner Tracker`:'Aligner Tracker';$('toggle').disabled=blocked;
}
function renderHistory(){const [lo,hi]=dayBounds($('day').value||dayKey(Date.now()));const rows=state.breaks.filter(b=>b.start<hi&&(b.end??Date.now())>lo).slice().reverse();$('history').replaceChildren();
  if(!rows.length){const p=document.createElement('p');p.className='muted';p.textContent='No breaks recorded for this day.';$('history').append(p);}
  for(const b of rows){const row=document.createElement('div');row.className='break-row';const info=document.createElement('div'),title=document.createElement('p'),detail=document.createElement('small'),button=document.createElement('button');title.textContent=(b.note||'Aligner break')+((b.estimatedStart||b.estimatedEnd)?' · Estimated':'');detail.textContent=`${new Date(b.start).toLocaleString()}${b.estimatedStart?' (estimated)':''} → ${b.end?new Date(b.end).toLocaleString():'Ongoing'}${b.end&&b.estimatedEnd?' (estimated)':''}`;info.append(title,detail);button.textContent='Edit';button.setAttribute('aria-label',`Edit break starting ${new Date(b.start).toLocaleString()}`);button.onclick=()=>edit(b);row.append(info,button);$('history').append(row);}
}
function render(){tick();renderHistory();}
$('toggle').onclick=()=>act(()=>{const b=active(),now=Date.now();commit({...state,breaks:b?state.breaks.map(x=>x.id===b.id?{...x,end:now}:x):[...state.breaks,{id:crypto.randomUUID(),start:now,end:null,note:''}]});});
$('day').onchange=render;
let editRaw;
function edit(b){editRaw=raw;$('editId').value=b?.id||'';$('start').value=localInput(b?.start??Date.now()-60000);$('end').value=b?(b.end?localInput(b.end):''):localInput(Date.now());$('note').value=b?.note||'';$('estimatedStart').checked=b?.estimatedStart??!b;$('estimatedEnd').checked=b?.estimatedEnd??!b;$('delete').hidden=!b;$('editTitle').textContent=b?'Edit break':'Add a missed break';$('editError').textContent='';$('editor').showModal();}
$('add').onclick=()=>edit();$('cancel').onclick=()=>$('editor').close();
$('editForm').onsubmit=e=>{e.preventDefault();try{if(editRaw!==raw)throw Error('History changed while you were editing. Cancel and reopen this break.');const b={id:$('editId').value||crypto.randomUUID(),start:parseInput($('start').value),end:parseInput($('end').value),note:$('note').value.trim(),estimatedStart:$('estimatedStart').checked,estimatedEnd:!!$('end').value&&$('estimatedEnd').checked};commit(saveBreak(state,b));$('editor').close();}catch(e){$('editError').textContent=e.message;}};
$('delete').onclick=()=>{if(confirm('Delete this break? Its time will be removed from your time-out total.'))act(()=>{commit({...state,breaks:state.breaks.filter(b=>b.id!==$('editId').value)});$('editor').close();});};
$('settings').onsubmit=e=>{e.preventDefault();act(()=>{commit({...state,goalHours:24-Number($('goal').value)/60});message('Daily allowance saved.');});};
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>act(()=>{const saved=localStorage.getItem(KEY);download(blocked?(saved??'{}'):JSON.stringify({app:'aligner-tracker',exportedAt:new Date().toISOString(),data:state},null,2),`aligner-tracker-${dayKey(Date.now())}${blocked?'-recovery':''}.json`);message('Backup download requested. Keep the file somewhere safe.');});
$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{try{const file=$('file').files[0];if(!file)return;if(file.size>10000000)throw Error('Backup is too large (maximum 10 MB).');const parsed=JSON.parse(await file.text());if(parsed.app!=='aligner-tracker')throw Error('This backup format is not recognised. Keep the original file so it can be migrated safely.');const next=validate(parsed.data);if(confirm(`Replace all current data with ${next.breaks.length} breaks from this backup? Export your current data first if you need to keep it.`)){commit(next);$('goal').value=Math.round((24-state.goalHours)*60);syncReminders();message('Backup imported.');}}catch(e){message(e.message);}finally{$('file').value='';}};
window.addEventListener('storage',e=>{if(e.key===KEY){try{if(!e.newValue)throw Error('Saved data was removed in another window. Reload before tracking.');state=validate(JSON.parse(e.newValue));raw=e.newValue;$('goal').value=Math.round((24-state.goalHours)*60);syncReminders();render();}catch(e){blocked=true;message(e.message);tick();}}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});setInterval(tick,1000);
let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install').hidden=false;});$('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('install').hidden=true;}};window.addEventListener('appinstalled',()=>{$('install').hidden=true;});
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').then(async reg=>{await navigator.serviceWorker.ready;$('offline').textContent='Offline access is ready on this device.';reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)message('An app update is ready. Close all tracker windows and reopen to use it. Your data stays saved.');});});}).catch(()=>{$('offline').textContent='Offline access could not be prepared. Open the published HTTPS site and try again.';});}else{$('offline').textContent='Offline installation is not supported in this browser.';}

// Forgotten times are previewed in the existing editor before any record changes.
let forgotMode='start';
$('forgot').onclick=()=>{$('shortcuts').hidden=true;$('forgotHint').textContent='Choose what you missed. You can review the time before saving.';$('forgotStart').disabled=!!active();$('forgotEnd').disabled=!active();$('forgotDialog').showModal();};
$('forgotCancel').onclick=()=>$('forgotDialog').close();
function forgotChoice(mode){
  forgotMode=mode;$('forgotHint').textContent=mode==='start'?'When did you take your aligners out?':'When did you put your aligners back in?';
  $('shortcuts').replaceChildren();$('shortcuts').hidden=false;
  for(const minutes of [5,10,15,30]){const button=document.createElement('button');button.textContent=`${minutes} minutes ago`;button.onclick=()=>forgotTime(minutes);$('shortcuts').append(button);}
  const custom=document.createElement('button');custom.textContent='Custom time';custom.onclick=()=>forgotTime(null);$('shortcuts').append(custom);
}
function forgotTime(minutes){
  const b=active();$('forgotDialog').close();
  if(forgotMode==='end'){
    if(!b){message('There is no ongoing break to correct.');return;}
    edit(b);$('end').value=localInput(Date.now()-(minutes??5)*60000);$('estimatedEnd').checked=true;$('editTitle').textContent='I forgot to stop';
    if(minutes===null)$('end').focus();
  }else{
    if(b){message('A break is already running. Edit it from history.');return;}
    edit();$('start').value=localInput(Date.now()-(minutes??5)*60000);$('end').value='';$('estimatedStart').checked=true;$('estimatedEnd').checked=false;$('editTitle').textContent='I forgot to start';
    if(minutes===null)$('start').focus();
  }
}
$('forgotStart').onclick=()=>forgotChoice('start');$('forgotEnd').onclick=()=>forgotChoice('end');
$('forgotComplete').onclick=()=>{$('forgotDialog').close();edit();};

function reminderPrefs(){return state.reminders??{enabled:false,minutes:[15,30,45]};}
function syncReminders(){const r=reminderPrefs();$('remindersEnabled').checked=r.enabled;$('reminderMinutes').value=r.minutes.join(', ');}
let reminderKey='',lastReminder=0,notificationReg=null;
function checkReminders(b,now){
  const r=reminderPrefs(),key=b?`${b.id}:${b.start}:${r.minutes.join(',')}`:'';
  if(key!==reminderKey){$('reminderBanner').hidden=true;reminderKey=key;lastReminder=0;try{lastReminder=Number(sessionStorage.getItem('aligner-reminder:'+key))||0;}catch{}}
  if(!b||!r.enabled){$('reminderBanner').hidden=true;return;}
  const due=dueReminder(b,r.minutes,now,lastReminder);if(!due)return;
  lastReminder=due;try{sessionStorage.setItem('aligner-reminder:'+key,String(due));}catch{}
  $('reminderBanner').hidden=false;$('reminderBanner').textContent=`Your break has reached ${due} minutes. Ready to put your aligners back in?`;
  if(notificationReg && 'Notification' in window && Notification.permission==='granted'){
    const options={body:`Break: ${duration(now-b.start)}. Tap to return to your tracker.`,tag:'aligner-active-break',icon:'./icons/icon-192.png',data:{breakId:b.id}};
    if(Notification.maxActions>0)options.actions=[{action:'stop',title:'Stop break…'}];
    notificationReg.showNotification('Aligners are still out',options).catch(()=>message('Phone notification could not be shown. The in-app reminder is still available.'));
  }
}
$('reminderSettings').onsubmit=e=>{e.preventDefault();act(()=>{const tokens=$('reminderMinutes').value.split(',').map(x=>x.trim());if(tokens.some(x=>!/^\d+$/.test(x)))throw Error('Enter whole minutes separated by commas, such as 15, 30, 45.');commit({...state,reminders:{enabled:$('remindersEnabled').checked,minutes:tokens.map(Number)}});syncReminders();message('Reminders saved. Keep the app open; closed or suspended apps may miss reminders.');});};
$('notifications').onclick=async()=>{
  if(!('Notification' in window)||!('serviceWorker' in navigator)){message('Phone notifications are unavailable in this browser. In-app reminders still work.');return;}
  try{const permission=await Notification.requestPermission();message(permission==='granted'?'Phone notifications enabled. Also enable reminders above. Delivery is not reliable when the app is closed or suspended.':'Notifications were not enabled. You can still use in-app reminders.');}catch{message('Notifications are unavailable. In-app reminders still work.');}
};
if('serviceWorker' in navigator)navigator.serviceWorker.ready.then(reg=>{notificationReg=reg;});
function notificationReturn(){
  const params=new URLSearchParams(location.hash.slice(1));if(!params.has('break'))return;
  const id=params.get('break'),b=active();history.replaceState(null,'',location.pathname+location.search);
  if(!b||b.id!==id){message('That notification is for a break that is no longer active. No data changed.');return;}
  if(params.get('action')==='stop'){
    edit(b);const requested=Number(params.get('at')),now=Date.now();$('end').value=localInput(Number.isFinite(requested)&&requested>b.start&&requested<=now?requested:now);$('estimatedEnd').checked=false;$('editTitle').textContent='Confirm end of break';
  }else{document.querySelector('.timer').scrollIntoView({behavior:'smooth'});message('Your current break is shown above.');}
}
window.addEventListener('hashchange',notificationReturn);
syncReminders();render();notificationReturn();
