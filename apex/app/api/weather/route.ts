import { NextResponse } from 'next/server';
import { currentWeather, searchLocations, WeatherError } from '@/lib/weather-service.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
 const url=new URL(request.url);
 try {
  if(url.searchParams.has('q')) return NextResponse.json({locations:await searchLocations(url.searchParams.get('q')||'')});
  return NextResponse.json(await currentWeather(url.searchParams.get('latitude'),url.searchParams.get('longitude')));
 } catch(e) { return NextResponse.json({error:e instanceof Error?e.message:'Weather unavailable.'},{status:e instanceof WeatherError?e.status:502}); }
}
