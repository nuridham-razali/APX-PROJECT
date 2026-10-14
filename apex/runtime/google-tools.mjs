import {Unavailable} from './node-tools.mjs';
const cache=new Map();
export const googleConfigured=env=>Boolean(env.APEX_GOOGLE_ACCESS_TOKEN||(env.APEX_GOOGLE_CLIENT_ID&&env.APEX_GOOGLE_CLIENT_SECRET&&env.APEX_GOOGLE_REFRESH_TOKEN));
export async function googleRequest(url,env,signal,fetcher=fetch,options={}){
 if(!googleConfigured(env))throw new Unavailable('Not configured: connect your Google account on the backend.');
 const deadline=AbortSignal.any([signal,AbortSignal.timeout(15000)]);
 let token=env.APEX_GOOGLE_ACCESS_TOKEN;
 if(env.APEX_GOOGLE_REFRESH_TOKEN&&env.APEX_GOOGLE_CLIENT_ID&&env.APEX_GOOGLE_CLIENT_SECRET){
  const key=env.APEX_GOOGLE_CLIENT_ID+env.APEX_GOOGLE_REFRESH_TOKEN;
  let entry=cache.get(key);
  if(!entry||entry.expiresAt<Date.now()+30000){
   const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.APEX_GOOGLE_CLIENT_ID,client_secret:env.APEX_GOOGLE_CLIENT_SECRET,refresh_token:env.APEX_GOOGLE_REFRESH_TOKEN,grant_type:'refresh_token'}),signal:deadline,redirect:'error'});
   if(!response.ok)throw new Unavailable('Google sign-in expired or was revoked. Reconnect the account.');
   const data=await response.json();if(typeof data.access_token!=='string')throw new Error('Google returned no usable access token.');
   entry={token:data.access_token,expiresAt:Date.now()+Math.min(3600,Number(data.expires_in)||300)*1000};cache.set(key,entry);
  }
  token=entry.token;
 }
 let response;try{response=await fetcher(url,{...options,headers:{...options.headers,Authorization:`Bearer ${token}`},signal:deadline,redirect:'error'});}catch(error){if(signal.aborted)throw error;throw new Error('Google service request failed or timed out. No successful action receipt.');}
 if(!response.ok)throw new Error(`Google service returned HTTP ${response.status}. Check account access and OAuth scopes; no successful action receipt.`);
 return response;
}
const id=value=>{if(typeof value!=='string'||! /^[a-zA-Z0-9_-]{1,200}$/.test(value))throw new Error('Invalid Google record ID.');return value;};
const bounded=value=>typeof value==='string'?value.slice(0,500):'';
function mailText(part){if(!part)return '';if(part.mimeType==='text/plain'&&part.body?.data)return Buffer.from(part.body.data,'base64url').toString('utf8').slice(0,16000);return (part.parts||[]).map(mailText).filter(Boolean).join('\n').slice(0,16000);}
export async function googleRead(node,env,signal,fetcher,input={}){
 const read=async url=>(await googleRequest(url,env,signal,fetcher)).json();
 if(node==='email'){
  const query=new URLSearchParams({maxResults:'10',q:bounded(input.query)||'in:inbox'});
  const list=await read('https://gmail.googleapis.com/gmail/v1/users/me/messages?'+query),records=[];
  for(const message of list.messages||[]){signal.throwIfAborted();const data=await read('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+id(message.id)+'?format=full');const header=name=>(data.payload?.headers||[]).find(h=>h.name?.toLowerCase()===name)?.value||'';records.push({id:data.id,threadId:data.threadId,subject:header('subject'),from:header('from'),to:header('to'),date:header('date'),snippet:data.snippet||'',text:mailText(data.payload),labels:data.labelIds||[]});}
  return {service:'Gmail',records,truncated:Boolean(list.nextPageToken),scope:'Up to 10 matching messages. Plain text only; attachments are not read.'};
 }
 if(node==='calendar'){
  const limit=Number.isInteger(input.limit)?Math.max(1,Math.min(50,input.limit)):50;
  const start=input.start?new Date(input.start):new Date(),end=input.end?new Date(input.end):new Date(start.getTime()+7*86400000);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||end-start>31*86400000)throw new Error('Choose a valid calendar window of at most 31 days.');
  const data=await read('https://www.googleapis.com/calendar/v3/calendars/primary/events?'+new URLSearchParams({timeMin:start.toISOString(),timeMax:end.toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:String(limit),...(input.query?{q:bounded(input.query)}:{})}));
  const records=(data.items||[]).filter(e=>e.status!=='cancelled').map(e=>({id:e.id,summary:e.summary,start:e.start,end:e.end,transparency:e.transparency,attendees:e.attendees?.map(a=>({email:a.email,responseStatus:a.responseStatus})),htmlLink:e.htmlLink,status:e.status}));
  const busy=records.filter(e=>e.start?.dateTime&&e.end?.dateTime&&e.transparency!=='transparent');
  const conflicts=[];for(let i=0;i<busy.length;i++)for(let j=i+1;j<busy.length;j++){const a=busy[i],b=busy[j];if(Date.parse(a.start.dateTime)<Date.parse(b.end.dateTime)&&Date.parse(b.start.dateTime)<Date.parse(a.end.dateTime))conflicts.push([a.id,b.id]);}
  return {service:'Google Calendar',records,conflicts,truncated:Boolean(data.nextPageToken),scope:`Primary calendar, selected date window, up to ${limit} events. Conflicts cover timed busy events only; all-day and transparent events are excluded. Availability is incomplete if truncated.`};
 }
 if(node==='drive'){
  if(input.fileId){const fileId=id(input.fileId),metadata=await read('https://www.googleapis.com/drive/v3/files/'+fileId+'?fields=id,name,mimeType,modifiedTime,webViewLink');
   const mime=metadata.mimeType;let url;if(mime==='application/vnd.google-apps.document')url='https://www.googleapis.com/drive/v3/files/'+fileId+'/export?mimeType=text%2Fplain';else if(['text/plain','text/markdown','text/csv','application/json'].includes(mime))url='https://www.googleapis.com/drive/v3/files/'+fileId+'?alt=media';else throw new Unavailable('This file format needs a connected document reader. Supported: Google Docs, plain text, Markdown, CSV and JSON.');
   const response=await googleRequest(url,env,signal,fetcher);if(Number(response.headers.get('content-length'))>200000)throw new Error('Drive document exceeds 200 KB.');
   let bytes=0;const chunks=[];for await(const chunk of response.body){bytes+=chunk.length;if(bytes>200000)throw new Error('Drive document exceeds 200 KB.');chunks.push(Buffer.from(chunk));}const text=Buffer.concat(chunks).toString('utf8');
   return {service:'Google Drive',document:{...metadata,text},scope:'Authorised document read; no sharing, deletion or edits.'};
  }
  const query=bounded(input.query).replaceAll('\\','\\\\').replaceAll("'","\\'");const data=await read('https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({pageSize:'30',q:'trashed = false'+(query?` and name contains '${query}'`:''),fields:'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)'}));return {service:'Google Drive',records:data.files||[],truncated:Boolean(data.nextPageToken),scope:'Up to 30 matching authorised files. Supply fileId to read a supported document.'};
 }
 throw new Unavailable('Google integration handler unavailable.');
}
export async function gmailSend(input,env,signal,fetcher=fetch){
 if(typeof input.to!=='string'||! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(input.to)||typeof input.subject!=='string'||/[\r\n]/.test(input.subject)||typeof input.text!=='string'||input.text.length>8000)throw new Error('Supply one verified recipient, a single-line subject and bounded plain-text message.');
 const subject='=?UTF-8?B?'+Buffer.from(input.subject).toString('base64')+'?=';
 const raw=Buffer.from(`To: ${input.to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(input.text).toString('base64')}`).toString('base64url');
 const data=await (await googleRequest('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',env,signal,fetcher,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({raw})})).json();if(!data.id)throw new Error('Gmail returned no sending receipt. Do not automatically retry.');return {service:'Gmail',accepted:true,delivered:false,id:data.id,recipient:input.to,notice:'Gmail accepted the message. Delivery is not independently verified.'};
}
