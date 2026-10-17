import type { Change, ProjectState, VoiceState } from './types';
export const defaults = ():VoiceState => ({samples:[],processing:{gain:0,normalize:true,peak:-1,gateDb:-72,highpass:50,low:0,mid:0,high:0,fadeMs:5,rate:1,pitch:1,tone:'natural'},generation:{temperature:0.8,topK:1000,topP:0.95,repetitionPenalty:1.2},issues:[]});
export function applyChange(state:VoiceState, change:Change):void {
  if(change.type==='sample-add') {if(state.samples.some(s=>s.id===change.sample.id))throw Error('Duplicate sample addition');state.samples.push({...change.sample});}
  else if(change.type==='sample-update'){const sample=state.samples.find(s=>s.id===change.id);if(!sample)throw Error('Sample edit precedes its enabled sample-add');Object.assign(sample,change.patch);}
  else if(change.type==='sample-order'){if(new Set(change.ids).size!==change.ids.length || change.ids.some(id=>!state.samples.some(s=>s.id===id)))throw Error('Sample order references a missing or duplicate sample');state.samples.sort((a,b)=>{const ia=change.ids.indexOf(a.id),ib=change.ids.indexOf(b.id);return(ia<0?999:ia)-(ib<0?999:ib)});}
  else if(change.type==='processing') Object.assign(state.processing,change.patch);
  else if(change.type==='generation') Object.assign(state.generation,change.patch);
  else throw Error('Unknown edit operation');
}
export function replay(project:ProjectState, projection?:string[]):VoiceState {
  const state=defaults();const order=projection??project.order.filter(id=>!project.disabled.includes(id));const seen=new Set<string>();
  for(const id of order){const event=project.events.find(e=>e.id===id);if(!event||seen.has(id)){state.issues.push('Missing or duplicate edit '+id);continue;}seen.add(id);try{applyChange(state,event.change);}catch(error){state.issues.push(event.label+': '+String(error));}}
  return state;
}
export function appendEdit(project:ProjectState,change:Change,label:string):void {const id=crypto.randomUUID();project.events.push({id,at:new Date().toISOString(),label,change:structuredClone(change)});project.order.push(id);}
export function undoLast(project:ProjectState,count:number):void {if(count<1)return;const active=project.order.filter(id=>!project.disabled.includes(id));project.disabled.push(...active.slice(-Math.max(0,Math.floor(count))));project.disabled=[...new Set(project.disabled)];}
