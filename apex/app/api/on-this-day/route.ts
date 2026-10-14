import { NextResponse } from 'next/server';
import { calendarDate, historyForDate } from '@/lib/history-service.mjs';
export async function GET(request:Request) {
 const date=new URL(request.url).searchParams.get('date');
 try{calendarDate(date);}catch{return NextResponse.json({error:'Choose a valid calendar date.'},{status:400});}
 try{return NextResponse.json(await historyForDate(date));}catch{return NextResponse.json({error:'On this day is unavailable. Please retry.'},{status:502});}
}
