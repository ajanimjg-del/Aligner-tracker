export const KEY = 'aligner-tracker.v1';
export function dayKey(t) { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function dayBounds(key) { const [y,m,d] = key.split('-').map(Number); return [new Date(y,m-1,d).getTime(),new Date(y,m-1,d+1).getTime()]; }
export function validate(s, now=Date.now()) {
  if (!s || s.version!==1 || !Number.isFinite(s.startedAt) || s.startedAt<0 || s.startedAt>now || !Number.isFinite(s.goalHours) || s.goalHours<1 || s.goalHours>24 || !Array.isArray(s.breaks)) throw Error('This is not a supported Aligner Tracker backup. Your current data has not changed.');
  const ids=new Set(); let previousEnd=-1;
  const breaks=s.breaks.map(b=>{
    if (!b || typeof b.id!=='string' || !b.id || ids.has(b.id) || !Number.isFinite(b.start) || b.start<s.startedAt || b.start>now || (b.end!==null && (!Number.isFinite(b.end) || b.end<=b.start || b.end>now)) || typeof b.note!=='string' || b.note.length>500) throw Error('A break has invalid dates, notes or an ID. Nothing was changed.');
    if (['estimatedStart','estimatedEnd'].some(k=>b[k]!==undefined && typeof b[k]!=='boolean')) throw Error('Invalid estimated-time flags.');
    ids.add(b.id); return {id:b.id,start:b.start,end:b.end,note:b.note,estimatedStart:b.estimatedStart??false,estimatedEnd:b.estimatedEnd??false};
  }).sort((a,b)=>a.start-b.start);
  for (const b of breaks) { if(b.start<previousEnd) throw Error('Breaks cannot overlap. Adjust the times and try again.'); previousEnd=b.end??Infinity; }
  const reminders=s.reminders??{enabled:false,minutes:[15,30,45]};
  if(typeof reminders.enabled!=='boolean'||!Array.isArray(reminders.minutes)||!reminders.minutes.length||reminders.minutes.length>10||reminders.minutes.some(n=>!Number.isInteger(n)||n<1||n>1440)) throw Error('Use 1–10 reminder times, from 1 to 1440 minutes.');
  return {version:1,startedAt:s.startedAt,goalHours:s.goalHours,breaks,reminders:{enabled:reminders.enabled,minutes:[...new Set(reminders.minutes)].sort((a,b)=>a-b)}};
}
export function totals(s,key,now=Date.now()) {
  const [start,end]=dayBounds(key), until=Math.min(end,now), from=Math.max(start,s.startedAt);
  const tracked=Math.max(0,until-from);
  const out=s.breaks.reduce((sum,b)=>sum+Math.max(0,Math.min(b.end??now,until)-Math.max(b.start,from)),0);
  return {out,wear:Math.max(0,tracked-out),tracked,dayLength:end-start};
}
export function duration(ms) { const secs=Math.max(0,Math.floor(ms/1000)); return `${String(Math.floor(secs/3600)).padStart(2,'0')}:${String(Math.floor(secs/60)%60).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`; }

export function saveBreak(s,b,now=Date.now()) {
  return validate({...s,startedAt:Math.min(s.startedAt,b.start),breaks:[...s.breaks.filter(x=>x.id!==b.id),b]},now);
}
export function dueReminder(b,minutes,now,last=0) {
  if(!b || b.end!==null)return 0;
  return Math.max(0,...minutes.filter(m=>m>last && now-b.start>=m*60000));
}
