// Local, user-operated OAuth connection. Does not send mail or change calendars/files.
import http from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
try{process.loadEnvFile('.env.local');}catch{}
const clientId=process.env.APEX_GOOGLE_CLIENT_ID,clientSecret=process.env.APEX_GOOGLE_CLIENT_SECRET;
if(!clientId||!clientSecret){console.error('Set APEX_GOOGLE_CLIENT_ID and APEX_GOOGLE_CLIENT_SECRET privately in .env.local first. See docs/GOOGLE-CONNECTION.md.');process.exit(1);}
const redirect='http://127.0.0.1:8094/callback',state=randomBytes(32).toString('hex'),verifier=randomBytes(48).toString('base64url');
const scopes=['https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/calendar.readonly','https://www.googleapis.com/auth/drive.readonly'];
if(process.argv.includes('--allow-mail-send'))scopes.push('https://www.googleapis.com/auth/gmail.send');
const auth='https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',scope:scopes.join(' '),access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
let processing=false;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:8094');
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 if(url.pathname==='/'){res.writeHead(302,{Location:auth,'Cache-Control':'no-store'});res.end();return;}
 const given=url.searchParams.get('state')||'';
 if(url.pathname!=='/callback'||given.length!==state.length||!timingSafeEqual(Buffer.from(given),Buffer.from(state))||processing){res.writeHead(400);res.end('Invalid or already used connection request.');return;}
 if(url.searchParams.has('error')){res.writeHead(400);res.end('Google connection was not approved. No settings changed.');return;}
 const code=url.searchParams.get('code');if(!code){res.writeHead(400);res.end('Missing authorization code.');return;}
 processing=true;
 try{
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,redirect_uri:redirect,grant_type:'authorization_code',code_verifier:verifier}),signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok)throw Error();const data=await response.json();if(typeof data.refresh_token!=='string'||!data.refresh_token||/[\r\n]/.test(data.refresh_token))throw Error();
  let content=readFileSync('.env.local','utf8');for(const [key,value] of Object.entries({APEX_INTEGRATION_PROVIDER:'google',APEX_GOOGLE_REFRESH_TOKEN:data.refresh_token})){const pattern=new RegExp('^'+key+'=.*$','gm');content=pattern.test(content)?content.replace(pattern,key+'='+value):content.trimEnd()+'\n'+key+'='+value+'\n';}writeFileSync('.env.local',content,{mode:0o600});
  res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('Google account connected to APEX. Restart the APEX runtime. No email was sent and no calendar or file was changed.');console.log('Google refresh token saved privately. Restart the APEX runtime.');clearTimeout(timer);server.close();
 }catch{res.writeHead(502);res.end('Google connection failed. Check the OAuth application and approved scopes. No settings changed.');processing=false;}
});
server.on('error',()=>{console.error('Cannot open local connection port 8094. Close the previous connection helper and retry.');process.exitCode=1;});
const timer=setTimeout(()=>{console.log('Google connection timed out without changing settings.');server.close();},600000);timer.unref();
server.listen(8094,'127.0.0.1',()=>console.log('Open http://127.0.0.1:8094/ to connect Google. Callback: '+redirect+'\nScopes: read Gmail, Calendar and Drive'+(process.argv.includes('--allow-mail-send')?', and permission to send approval-confirmed email.':'. Email sending remains unavailable without its scope.')));
