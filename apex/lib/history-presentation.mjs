// Keep manually corroborated claims distinct from an official publisher's records.
export function validHistoryEvent(data,date){
 if(!data||data.date!==date)return false;
 if(data.verification==='unavailable')return typeof data.text==='string'&&!data.year;
 if(!Number.isInteger(data.year)||data.year>Number(date.slice(0,4))||typeof data.text!=='string'||!data.text.trim())return false;
 const sources=Array.isArray(data.sources)?data.sources:[];
 if(!sources.length||sources.some(source=>{try{return !source.name||new URL(source.url).protocol!=='https:';}catch{return true;}}))return false;
 if(data.verification==='source-reviewed')return Boolean(data.reviewedAt)&&sources.length>=2;
 if(data.verification==='institutional-record')return Boolean(data.sourceCheckedAt)&&data.sourceName==='Naval History and Heritage Command'&&sources.every(source=>new URL(source.url).hostname==='www.history.navy.mil');
 return false;
}
