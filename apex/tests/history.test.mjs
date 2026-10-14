import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDate,historyForDate} from '../lib/history-service.mjs';
import {HISTORY_CALENDAR} from '../lib/history-calendar.mjs';
import {validHistoryEvent} from '../lib/history-presentation.mjs';
test('calendar validation accepts leap days and rejects impossible or missing dates',()=>{
 assert.deepEqual(calendarDate('2028-02-29'),{year:2028,month:'02',day:'29'});
 for(const date of ['2026-02-29','2026-04-31','2026-13-01','10/03',null])assert.throws(()=>calendarDate(date));
});
test('only reviewed claims carry institution attribution and review provenance',async()=>{
 const result=await historyForDate('2026-10-07');
 assert.equal(result.date,'2026-10-07');assert.equal(result.year,1959);
 assert.equal(result.verification,'source-reviewed');assert.equal(result.sourceName,'NASA');
 assert.equal(result.reviewedAt,'2026-10-07');
 assert.equal(result.source,'https://science.nasa.gov/resource/first-close-up-of-the-far-side-of-moon/');
 assert.equal(result.sources.length,2);
 assert.deepEqual(result.sources.map(source=>source.name),['NASA','Smithsonian National Air and Space Museum']);
 assert.match(result.text,/Luna 3/);
});
test('dates before the available historical records never receive invented claims',async()=>{
 for(const date of ['1000-10-03','1000-10-09','1000-10-07']){
  const result=await historyForDate(date);
  assert.equal(result.verification,'unavailable');assert.equal(result.source,undefined);
  assert.equal(result.year,undefined);assert.equal(result.text,'No verified event available for this date.');
 }
});
test('today can use a separately reviewed institutional event',async()=>{
 const result=await historyForDate('2026-10-08');
 assert.equal(result.verification,'source-reviewed');assert.equal(result.year,1871);
 assert.equal(result.sources.length,2);assert.match(result.text,/Great Chicago Fire/);
});
test('history works offline and makes no unchecked network requests',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=()=>{throw new Error('Unexpected network request');};
 try{assert.equal((await historyForDate('2026-10-07')).verification,'source-reviewed');}
 finally{globalThis.fetch=original;}
});
test('October 11 has a corroborated event and never appears before its historical year',async()=>{
 const result=await historyForDate('2026-10-11');
 assert.equal(result.verification,'source-reviewed');assert.equal(result.year,1968);
 assert.match(result.text,/Apollo 7 launched/);
 assert.equal(result.reviewedAt,'2026-10-11');
 assert.deepEqual(result.sources.map(source=>new URL(source.url).hostname),['www.nasa.gov','airandspace.si.edu']);
 assert.notEqual((await historyForDate('1967-10-11')).year,1968);
 assert.equal((await historyForDate('2027-10-11')).text,result.text);
});
test('every date in a leap year has an official, displayable, date-matched record',async()=>{
 assert.equal(HISTORY_CALENDAR.length,366);
 const dates=new Set();
 for(let day=new Date('2028-01-01T00:00:00Z');day.getUTCFullYear()===2028;day.setUTCDate(day.getUTCDate()+1)){
  const date=day.toISOString().slice(0,10),result=await historyForDate(date);
  assert.notEqual(result.verification,'unavailable',date);
  assert.equal(validHistoryEvent(result,date),true,date);
  assert.ok(result.year<=2028);assert.doesNotMatch(result.text,/<[^>]*>|&\w+;/);
  dates.add(`${date.slice(5)}`);
 }
 assert.equal(dates.size,366);
 assert.equal(new Set(HISTORY_CALENDAR.map(e=>`${e.month}-${e.day}`)).size,366);
});
test('consecutive days and year rollover use their own events, without any network or model',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Network must not be required');};
 try{
  for(const dates of [['2026-10-11','2026-10-12','2026-10-13'],['2026-12-31','2027-01-01','2027-01-02'],['2028-02-28','2028-02-29','2028-03-01']]){
   const events=await Promise.all(dates.map(date=>historyForDate(date)));
   assert.deepEqual(events.map(e=>e.date),dates);
   assert.equal(new Set(events.map(e=>e.text)).size,3);
   assert.ok(events.every(e=>e.verification!=='unavailable'));
  }
 }finally{globalThis.fetch=original;}
});
test('display rejects wrong dates, missing provenance, unsupported publishers and future events',async()=>{
 const date='2026-10-12',event=await historyForDate(date);
 assert.equal(event.verification,'institutional-record');assert.ok(event.sourceCheckedAt);assert.equal(event.reviewedAt,undefined);
 assert.equal(validHistoryEvent(event,date),true);
 for(const data of [{...event,date:'2026-10-13'},{...event,sourceCheckedAt:null},{...event,verification:'generated'},{...event,year:3000},{...event,sources:[{name:'Unknown',url:'https://example.com/fake'}]}])assert.equal(validHistoryEvent(data,date),false);
});
test('known conflicting institutional claim is excluded rather than presented as confirmed',async()=>{
 const event=await historyForDate('2027-01-02');
 assert.doesNotMatch(event.text,/Weserland/);assert.equal(event.year,1991);
});
