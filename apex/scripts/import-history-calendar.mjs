// Import public institutional records, never model-generated historical claims.
// Usage: node scripts/import-history-calendar.mjs path/to/official-calendar.json
import {readFile,writeFile} from 'node:fs/promises';
const input=process.argv[2];
if(!input)throw new Error('Supply the JSON downloaded from the official NHHC calendar.');
const data=JSON.parse(await readFile(input,'utf8'));
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const source='https://www.history.navy.mil/content/history/nhhc/year-at-a-glance/jcr:content.getyearataglance.json?start=1&end=366';
const sourceCheckedAt=new Date().toISOString().slice(0,10);
// The calendar dates the Weserland sighting to 1942; the archival action report
// dates it to January 1944. Exclude the conflicting claim instead of repairing
// it with an invented year. Use another published event for this day.
// https://www.usna.edu/Library/sca/man-findingaids/view.php?f=MS_416
const disputed=(label,event)=>label==='January 2'&&event.date==='1942'&&event.summary.includes('Weserland');
const entities={amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',ndash:'–',mdash:'—'};
const plain=html=>html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,'').replace(/&(#x[\da-f]+|#\d+|\w+);/gi,(raw,value)=>{
 if(value[0]==='#'){const n=value[1].toLowerCase()==='x'?parseInt(value.slice(2),16):Number(value.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}
 return entities[value]??raw;
}).replace(/\s+/g,' ').trim();
const records=[];
for(let cursor=new Date('2024-01-01T00:00:00Z');cursor.getUTCFullYear()===2024;cursor.setUTCDate(cursor.getUTCDate()+1)){
 const month=cursor.getUTCMonth(),day=cursor.getUTCDate(),label=`${months[month]} ${day}`;
 const rows=data.days?.filter(row=>row.day===label);
 if(rows?.length!==1)throw new Error(`Missing or duplicate day: ${label}`);
 const candidates=rows[0].events.filter(event=>/^\d{4}$/.test(event.date)&&typeof event.summary==='string'&&!disputed(label,event)).map(event=>{
  const full=plain(event.summary);
  let text='';
  for(const part of new Intl.Segmenter('en',{granularity:'sentence'}).segment(full)){
   text=(text+' '+part.segment).trim();
   // Sentence segmentation may split a person's middle initial. Keep it intact.
   if(text.length>=40&&!/\b[A-Z]\.$/.test(text))break;
  }
  const detail=[...event.summary.matchAll(/href="([^"]+)"/g)].map(match=>match[1]).find(url=>{try{const parsed=new URL(url);return parsed.protocol==='https:'&&parsed.hostname==='www.history.navy.mil';}catch{return false;}});
  return {year:Number(event.date),text,detail};
 }).filter(event=>event.text?.length>=40&&event.text.length<=600&&!/[<>]|&\w+;/.test(event.text)).sort((a,b)=>a.text.length-b.text.length);
 if(!candidates.length)throw new Error(`No usable source text: ${label}`);
 const selected=candidates[0];
 records.push({month:String(month+1).padStart(2,'0'),day:String(day).padStart(2,'0'),year:selected.year,text:selected.text,
  source:`https://www.history.navy.mil/today-in-history/${months[month].toLowerCase()}-${day}.html`,sourceName:'Naval History and Heritage Command',
  ...(selected.detail?{recordSource:selected.detail}:{}),verification:'institutional-record',sourceCheckedAt});
}
await writeFile(new URL('../lib/history-calendar.mjs',import.meta.url),`// Official institutional calendar snapshot. No LLM-generated text.\n// Feed: ${source}\n// Regenerate with scripts/import-history-calendar.mjs; validates all 366 dates.\nexport const HISTORY_CALENDAR = ${JSON.stringify(records,null,1)};\n`);
console.log(`Imported ${records.length} date-matched institutional events.`);
