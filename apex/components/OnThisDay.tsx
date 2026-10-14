"use client";
import {useEffect,useState} from 'react';
import {validHistoryEvent} from '@/lib/history-presentation.mjs';
 type Event={date:string;year?:number;text:string;source?:string;sourceName?:string;sources?:{name:string;url:string}[];verification:'source-reviewed'|'institutional-record'|'unavailable';reviewedAt?:string;sourceCheckedAt?:string};
export default function OnThisDay({date}:{date:string}) {
 const [event,setEvent]=useState<Event|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!date)return;const controller=new AbortController();setEvent(null);setError('');void (async()=>{try{const response=await fetch(`/api/on-this-day?date=${encodeURIComponent(date)}`,{signal:controller.signal,cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error);if(!validHistoryEvent(data,date))throw new Error('Insufficient source evidence.');if(!controller.signal.aborted)setEvent(data);}catch{if(!controller.signal.aborted)setError('Verified event unavailable');}})();return()=>controller.abort();},[date,retry]);
 return <div className="on-this-day"><div className="hud-eyebrow">ON THIS DAY <span>{date?`${date.slice(8,10)} / ${date.slice(5,7)}`:''}</span></div>{event&&event.verification!=='unavailable'?<p><strong>{event.year}</strong> · {event.text}</p>:<p role="status">{event?.verification==='unavailable'?'No verified event available for this date.':error||'Checking today’s event…'}{error&&<button onClick={()=>setRetry(n=>n+1)}>Retry</button>}</p>}</div>;
}
