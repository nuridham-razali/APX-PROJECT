import {HISTORY_CALENDAR} from './history-calendar.mjs';
export function calendarDate(date) {
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid calendar date.');
 const parsed=new Date(`${date}T00:00:00Z`);if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw new Error('Invalid calendar date.');
 return {year:Number(date.slice(0,4)),month:date.slice(5,7),day:date.slice(8,10)};
}
// Reviewed against the linked institution's record; never populated by an LLM
// or an unchecked live feed. Add dates only after reviewing the exact claim.
const REVIEWED_EVENTS = Object.freeze([
 Object.freeze({month:'10',day:'07',year:1959,
  text:'Luna 3 took the first photographs of the far side of the Moon.',
  source:'https://science.nasa.gov/resource/first-close-up-of-the-far-side-of-moon/',
  sourceName:'NASA',
  sources:Object.freeze([
   Object.freeze({name:'NASA',url:'https://science.nasa.gov/resource/first-close-up-of-the-far-side-of-moon/'}),
   Object.freeze({name:'Smithsonian National Air and Space Museum',url:'https://airandspace.si.edu/multimedia-gallery/image/web12045-2011640jpg'})
  ]),
  verification:'source-reviewed',reviewedAt:'2026-10-07'}),
 Object.freeze({month:'10',day:'08',year:1871,
  text:'The Great Chicago Fire began on October 8, 1871, and burned through Chicago for three days.',
  source:'https://www.nps.gov/articles/000/fire-prevention-week-2024.htm',
  sourceName:'National Park Service',
  sources:Object.freeze([
   Object.freeze({name:'National Park Service',url:'https://www.nps.gov/articles/000/fire-prevention-week-2024.htm'}),
   Object.freeze({name:'Chicago History Museum',url:'https://www.chicagohistory.org/chicago-history-museum-commemorates-150th-anniversary-of-great-chicago-fire-in-new-exhibition/'})
  ]),
  verification:'source-reviewed',reviewedAt:'2026-10-08'}),
 Object.freeze({month:'10',day:'11',year:1968,
  text:'Apollo 7 launched on a Saturn IB rocket, becoming the first crewed mission of the Apollo programme.',
  source:'https://www.nasa.gov/image-article/apollo-7-launches-october-11-1968/',
  sourceName:'NASA',
  sources:Object.freeze([
   Object.freeze({name:'NASA',url:'https://www.nasa.gov/image-article/apollo-7-launches-october-11-1968/'}),
   Object.freeze({name:'Smithsonian National Air and Space Museum',url:'https://airandspace.si.edu/explore/stories/apollo-missions/apollo-7'})
  ]),
  verification:'source-reviewed',reviewedAt:'2026-10-11'})
]);
export async function historyForDate(date) {
 const {year,month,day}=calendarDate(date);
 const event=REVIEWED_EVENTS.find(e=>e.month===month&&e.day===day&&e.year<=year);
 if(!event){
  const record=HISTORY_CALENDAR.find(e=>e.month===month&&e.day===day&&e.year<=year);
  if(!record)return {date,verification:'unavailable',text:'No verified event available for this date.'};
  return {date,year:record.year,text:record.text,source:record.source,sourceName:record.sourceName,
   sources:[{name:record.sourceName,url:record.source},...(record.recordSource?[{name:'Institutional supporting record',url:record.recordSource}]:[])],
   verification:record.verification,sourceCheckedAt:record.sourceCheckedAt};
 }
 return {date,year:event.year,text:event.text,source:event.source,sourceName:event.sourceName,
  sources:event.sources,verification:event.verification,reviewedAt:event.reviewedAt};
}
