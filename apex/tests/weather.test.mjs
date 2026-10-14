import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinates,currentWeather,searchLocations } from '../lib/weather-service.mjs';
test('weather rejects missing, nonnumeric and out-of-range coordinates before network access',async()=>{
 for(const args of [[null,null],['','0'],['NaN','1'],['91','0'],['0','181']])assert.throws(()=>coordinates(...args),e=>e.status===400);
 assert.deepEqual(coordinates('0','0'),{latitude:0,longitude:0});
});
test('weather reads provider temperature and location timezone, retaining zero values',async()=>{
 const result=await currentWeather(5.8,100.4,async url=>{const u=new URL(url);assert.equal(u.hostname,'api.open-meteo.com');assert.equal(u.searchParams.get('timezone'),'auto');assert.equal(u.searchParams.get('timeformat'),'unixtime');return{ok:true,json:async()=>({timezone:'Asia/Kuala_Lumpur',current:{temperature_2m:0,apparent_temperature:0,relative_humidity_2m:0,wind_speed_10m:0,weather_code:95,is_day:0,time:1791000000}})};});
 assert.equal(result.temperature,0);assert.equal(result.humidity,0);assert.equal(result.condition,'Thunderstorm');assert.equal(result.timezone,'Asia/Kuala_Lumpur');assert.equal(result.isDay,false);assert.ok(result.observedAt.endsWith('Z'));
});
test('provider failure or missing current data never becomes sample weather',async()=>{
 await assert.rejects(currentWeather(5,100,async()=>({ok:false})),/unavailable/);
 await assert.rejects(currentWeather(5,100,async()=>({ok:true,json:async()=>({current:{temperature_2m:null}})})),/unavailable/);
 await assert.rejects(currentWeather(5,100,async()=>{throw Error('fixture offline');}),/internet/);
});
test('location search returns distinct matches for user selection and encodes the query',async()=>{
 const result=await searchLocations('Gurun & Kedah',async url=>{assert.equal(new URL(url).searchParams.get('name'),'Gurun & Kedah');return{ok:true,json:async()=>({results:[{id:1,name:'Gurun',admin1:'Kedah',country:'Malaysia',latitude:5.81,longitude:100.47,timezone:'Asia/Kuala_Lumpur'},{id:2,name:'Invalid'}]})};});
 assert.equal(result.length,1);assert.equal(result[0].name,'Gurun, Kedah, Malaysia');
 await assert.rejects(searchLocations('a'),e=>e.status===400);
});
