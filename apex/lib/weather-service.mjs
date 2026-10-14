export class WeatherError extends Error { constructor(message, status=502) { super(message); this.status=status; } }
export function coordinates(lat, lon) {
 if (lat === null || lon === null || String(lat).trim()==='' || String(lon).trim()==='') throw new WeatherError('Choose a location first.',400);
 const latitude=Number(lat),longitude=Number(lon);
 if (!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180) throw new WeatherError('Invalid location coordinates.',400);
 return {latitude,longitude};
}
export function weatherLabel(code) {
 const labels={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Heavy freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Heavy freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Rain showers',82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Heavy thunderstorm with hail'};
 return labels[code] || 'Unknown conditions';
}
async function requestJson(url, fetcher) {
 try {
  const response=await fetcher(url,{signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!response.ok) throw new WeatherError('Weather service is unavailable. Try again later.');
  return await response.json();
 } catch(e) { if(e instanceof WeatherError)throw e;throw new WeatherError('Unable to reach the weather service. Check your internet connection.'); }
}
export async function searchLocations(query, fetcher=fetch) {
 const name=query.trim();if(name.length<2||name.length>100)throw new WeatherError('Enter a town or city with 2–100 characters.',400);
 const url=new URL('https://geocoding-api.open-meteo.com/v1/search');url.search=new URLSearchParams({name,count:'6',language:'en',format:'json'}).toString();
 const data=await requestJson(url,fetcher);
 return (data.results||[]).map(r=>({id:r.id,name:[r.name,r.admin1,r.country].filter(Boolean).join(', '),latitude:r.latitude,longitude:r.longitude,timezone:r.timezone})).filter(r=>Number.isFinite(r.latitude)&&Number.isFinite(r.longitude));
}
export async function currentWeather(lat,lon,fetcher=fetch) {
 const {latitude,longitude}=coordinates(lat,lon);
 const url=new URL('https://api.open-meteo.com/v1/forecast');url.search=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),current:'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',timezone:'auto',timeformat:'unixtime',temperature_unit:'celsius',wind_speed_unit:'kmh',forecast_days:'1'}).toString();
 const data=await requestJson(url,fetcher);const c=data.current;
 if(!c || !Number.isFinite(c.temperature_2m)||!Number.isFinite(c.time))throw new WeatherError('Current weather data is unavailable.');
 let timezone=typeof data.timezone==='string'&&data.timezone?data.timezone:'UTC';try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format();}catch{timezone='UTC';}
 return {temperature:c.temperature_2m,feelsLike:Number.isFinite(c.apparent_temperature)?c.apparent_temperature:null,humidity:Number.isFinite(c.relative_humidity_2m)?c.relative_humidity_2m:null,wind:Number.isFinite(c.wind_speed_10m)?c.wind_speed_10m:null,code:c.weather_code,condition:weatherLabel(c.weather_code),isDay:c.is_day!==0,timezone,observedAt:new Date(c.time*1000).toISOString(),fetchedAt:new Date().toISOString()};
}
