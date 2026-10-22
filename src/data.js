import ICAL from 'ical.js';
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const uid = () => crypto.randomUUID();
export function parseExercises(description) {
 return description.split(/\n/).map(line => {
  const match = line.trim().match(/^(.+?)\s*[:–-]?\s+(\d+)\s*[x×]\s*(\d+)\s*(?:@\s*([\d.]+)\s*(kg|lbs?|%)?)?\s*$/i);
  return match ? {id:uid(),name:match[1].replace(/[:–-]$/,'').trim(),sets:Math.min(50,+match[2]),reps:+match[3],weight:match[4] || '',unit:match[5]?.toLowerCase().startsWith('lb') ? 'lb' : match[5] || 'kg',done:[]} : null;
 }).filter(Boolean).filter(e => e.sets > 0 && e.reps > 0);
}
export function importCalendar(text) {
 const root = new ICAL.Component(ICAL.parse(text));
 if(root.name !== 'vcalendar') throw new Error('Please select a valid iCalendar (.ics) file.');
 for(const tz of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz);
 const components = root.getAllSubcomponents('vevent');
 const events = components.filter(c=>!c.hasProperty('recurrence-id')).map(c=>new ICAL.Event(c));
 for(const exception of components.filter(c=>c.hasProperty('recurrence-id'))) {
  const parent=events.find(e=>e.uid===exception.getFirstPropertyValue('uid'));
  if(parent) parent.relateException(new ICAL.Event(exception));
 }
 const workouts=[]; let truncated=false;
 for(const event of events) {
  if(!event.startDate) continue;
  const iterator=event.iterator(); let count=0;
  while(count<366 && workouts.length<2000) {
   const next=iterator.next(); if(!next) break; count++;
   const detail=event.getOccurrenceDetails(next); const occurrence=detail.item;
   if(occurrence.component.getFirstPropertyValue('status')==='CANCELLED') continue;
   const start=detail.startDate;
   // Preserve the event's calendar date, including all-day and TZID dates.
   const date=start.toString().slice(0,10);
   const notes=occurrence.description || '';
   workouts.push({id:uid(),source:`${event.uid || event.summary}:${next.toString()}`,date,title:occurrence.summary || 'Imported workout',notes,exercises:parseExercises(notes),finished:false});
   if(!event.isRecurring()) break;
  }
  if(count===366 || workouts.length===2000) truncated=true;
 }
 return {workouts,truncated};
}
export function mergeWorkouts(existing,incoming) {
 const seen=new Set(existing.map(w=>w.source).filter(Boolean));
 return [...existing,...incoming.filter(w=>{if(seen.has(w.source))return false;seen.add(w.source);return true;})];
}
export function progress(workout) {
 const total=workout.exercises.reduce((n,e)=>n+e.sets,0);
 const done=workout.exercises.reduce((n,e)=>n+e.done.filter(s=>s>=0&&s<e.sets).length,0);
 return {total,done,percent:total?Math.round(done/total*100):0};
}
