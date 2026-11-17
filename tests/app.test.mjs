import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import * as core from '../core.mjs';
const source=fs.readFileSync(new URL('../app.mjs',import.meta.url),'utf8').replace(/^import .*;\n/,'');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function setup(){
 const now=Date.now(),data=new Map([[core.KEY,JSON.stringify({version:1,startedAt:now-86400000,goalHours:22,breaks:[]})]]);
 const make=()=>({value:'',textContent:'',checked:false,hidden:false,children:[],classList:{toggle(){}},append(...x){this.children.push(...x)},replaceChildren(){this.children=[]},setAttribute(){},showModal(){this.open=true},close(){this.open=false},focus(){},scrollIntoView(){},click(){this.onclick?.()}});
 const els=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(x=>[x[1],make()]));
 const handlers={};const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const ctx={...core,console,Date,Math,Number,String,JSON,Error,URL,URLSearchParams,Blob,setTimeout(){},setInterval(fn){ctx.tick=fn},crypto:{randomUUID},localStorage:storage,sessionStorage:{getItem(){return null},setItem(){}},navigator:{},location:{hash:'',pathname:'/',search:''},history:{replaceState(){}},confirm:()=>true,window:{addEventListener(k,fn){handlers[k]=fn}},document:{getElementById(id){assert.ok(els[id],`Missing DOM ID ${id}`);return els[id]},createElement:make,querySelector:()=>make(),addEventListener(){}}};
 vm.runInNewContext(source,ctx);return {els,ctx,data,handlers,read:()=>JSON.parse(data.get(core.KEY))};
}
const event={preventDefault(){}};
test('forgotten start shortcuts, correction and estimated labels through actual handlers',()=>{
 for(const minutes of [5,10,15,30]){
  const {els,read}=setup();els.forgot.onclick();els.forgotStart.onclick();els.shortcuts.children.find(x=>x.textContent===`${minutes} minutes ago`).click();assert.equal(read().breaks.length,0);assert.equal(els.estimatedStart.checked,true);els.editForm.onsubmit(event);assert.equal(els.editError.textContent,'');assert.equal(read().breaks.length,1);assert.equal(read().breaks[0].end,null);assert.ok(Math.abs(Date.now()-read().breaks[0].start-minutes*60000)<2000);assert.match(els.todaySummary.textContent,/Today:/);assert.match(els.history.children[0].children[0].children[0].textContent,/Estimated/);
  els.forgot.onclick();assert.equal(els.forgotStart.disabled,true);els.forgotEnd.onclick();els.shortcuts.children.find(x=>x.textContent==='Custom time').click();els.end.value=els.start.value;els.editForm.onsubmit(event);assert.match(els.editError.textContent,/invalid/);assert.equal(read().breaks[0].end,null);
  const end=new Date(Date.now()-60000);els.end.value=`${core.dayKey(end)}T${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}:${String(end.getSeconds()).padStart(2,'0')}`;els.editForm.onsubmit(event);assert.ok(read().breaks[0].end);assert.equal(read().breaks[0].estimatedEnd,true);
 }
});
test('complete missed break, duplicate rejection and reminder configuration',()=>{
 const {els,read,ctx}=setup();els.forgot.onclick();els.forgotComplete.onclick();els.editForm.onsubmit(event);const b=read().breaks[0];assert.ok(b.end);assert.equal(b.estimatedStart,true);assert.equal(b.estimatedEnd,true);
 const start=els.start.value,end=els.end.value;els.add.onclick();els.start.value=start;els.end.value=end;els.editForm.onsubmit(event);assert.match(els.editError.textContent,/overlap/);assert.equal(read().breaks.length,1);els.cancel.onclick();
 els.remindersEnabled.checked=true;els.reminderMinutes.value='5, 10, 15';els.reminderSettings.onsubmit(event);assert.deepEqual(read().reminders,{enabled:true,minutes:[5,10,15]});els.reminderMinutes.value='0';els.reminderSettings.onsubmit(event);assert.deepEqual(read().reminders.minutes,[5,10,15]);ctx.tick();
});
test('stale notification cannot end a different break; matching action requires save',()=>{
 const {els,ctx,handlers,read}=setup();els.toggle.onclick();const id=read().breaks[0].id;ctx.location.hash='#break=stale&action=stop';handlers.hashchange();assert.match(els.message.textContent,/no longer active/);assert.equal(read().breaks[0].end,null);
 ctx.location.hash=`#break=${id}&action=stop&at=${Date.now()}`;handlers.hashchange();assert.equal(els.editor.open,true);assert.equal(els.editTitle.textContent,'Confirm end of break');assert.equal(read().breaks[0].end,null);
});
