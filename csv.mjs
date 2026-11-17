import {validate} from './core.mjs';

// Parse quoted fields, escaped quotes and CRLF without guessing malformed input.
export function parseCSV(text) {
  if(typeof text!=='string'||text.length>2000000)throw Error('CSV must be smaller than 2 MB.');
  text=text.replace(/^\uFEFF/,'');
  const rows=[];let fields=[],field='',quoted=false,closed=false,line=1,rowLine=1;
  function finish(){fields.push(field);if(fields.length>1||fields[0].trim()!=='')rows.push({line:rowLine,fields});fields=[];field='';closed=false;}
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else{field+=c;if(c==='\n')line++;}continue;}
    if(c==='"'){if(field||closed)throw Error(`Line ${line}: unexpected quote.`);quoted=true;}
    else if(c===','){fields.push(field);field='';closed=false;}
    else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;finish();line++;rowLine=line;}
    else{if(closed)throw Error(`Line ${line}: unexpected text after a quoted field.`);field+=c;}
  }
  if(quoted)throw Error(`Line ${rowLine}: unclosed quoted field. Nothing imported.`);
  finish();if(rows.length>10001)throw Error('Import at most 10,000 records at a time.');return rows;
}
function timestamp(value){
  const s=value.trim();
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s))throw Error('Use an ISO UTC timestamp with milliseconds (YYYY-MM-DDTHH:mm:ss.sssZ).');
  const t=Date.parse(s);if(!Number.isFinite(t)||new Date(t).toISOString()!==s)throw Error('Invalid calendar date or time.');return t;
}
const overlaps=(a,b)=>a.start<(b.end??Infinity)&&b.start<a.end;
export function previewCSV(text,state,now=Date.now()){
  validate(state,now);
  const parsed=parseCSV(text),header=parsed.shift();
  if(!header)throw Error('The CSV is empty.');
  const names=header.fields.map(x=>x.trim());
  if(names.length!==3||new Set(names).size!==3||!['Start','End','Duration minutes'].every(x=>names.includes(x)))throw Error('Expected exactly these columns: Start, End, Duration minutes.');
  const existing=new Set(state.breaks.map(b=>`${b.start}/${b.end}`)),seen=new Map();
  const rows=parsed.map(row=>{
    const result={line:row.line,status:'ready',reason:''};
    try{
      if(row.fields.length!==3)throw Error('Expected 3 fields.');
      const start=timestamp(row.fields[names.indexOf('Start')]),end=timestamp(row.fields[names.indexOf('End')]);
      if(start<0||end<=start)throw Error('End must be after Start, with dates after 1970.');
      if(end>now)throw Error('Break ends in the future.');
      Object.assign(result,{start,end,durationMs:end-start});
      const key=`${start}/${end}`;
      if(existing.has(key)){result.status='skipped';result.reason='Exact duplicate of existing history.';}
      else if(seen.has(key)){result.status='skipped';result.reason=`Duplicate of CSV line ${seen.get(key)}.`;}
      else {seen.set(key,row.line);const conflict=state.breaks.find(b=>overlaps(result,b));if(conflict){result.status='rejected';result.reason=conflict.end===null?'Overlaps the active break.':'Overlaps an existing break.';}}
    }catch(e){result.status='rejected';result.reason=e.message;}
    return result;
  });
  // Include valid, nonduplicate rows rejected against history too: do not pick
  // an arbitrary winner among conflicting CSV rows.
  const candidates=rows.filter(r=>r.start!==undefined&&r.status!=='skipped'&&r.end>r.start&&r.end<=now).sort((a,b)=>a.start-b.start);
  let furthest=null;
  for(const r of candidates){if(furthest&&r.start<furthest.end){r.status='rejected';r.reason+=`${r.reason?' ':''}Overlaps CSV line ${furthest.line}.`;furthest.status='rejected';furthest.reason+=`${furthest.reason?' ':''}Overlaps CSV line ${r.line}.`;}if(!furthest||r.end>furthest.end)furthest=r;}
  return {rows,ready:rows.filter(r=>r.status==='ready').length,skipped:rows.filter(r=>r.status==='skipped').length,rejected:rows.filter(r=>r.status==='rejected').length};
}
export function mergeCSV(state,preview,makeId,now=Date.now()){
  const additions=preview.rows.filter(r=>r.status==='ready').map(r=>({id:makeId(),start:r.start,end:r.end,note:'Imported from CSV',estimatedStart:false,estimatedEnd:false}));
  const next={...state,startedAt:additions.reduce((t,b)=>Math.min(t,b.start),state.startedAt),breaks:[...state.breaks,...additions]};
  validate(next,now);return next;
}
