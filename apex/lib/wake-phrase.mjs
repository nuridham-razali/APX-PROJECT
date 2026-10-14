// Only recognised microphone input is parsed. No file, website or typed content
// uses this function. Match a leading address, never a word inside a request.
export const APEX_WAKE_REPLY="I'm here, Idham.";
const WAKE_PREFIX=/^(?:(?:hey|hye|hello|hi)[\s,]+)?(?:apex|a[\s-]+pex|a[\s-]+picks|a[\s-]+packs|pets|pet's|hit[\s-]+next|eight)(?=$|[\s,.!?;:\u2014-])[\s,.!?;:\u2014-]*/i;
export function extractApexWake(text){
 const raw=String(text||'').trim();const match=WAKE_PREFIX.exec(raw);
 return {called:Boolean(match),message:match?raw.slice(match[0].length).trim():raw};
}
export function isApexWakeOnly(text){let rest=String(text||'').trim(),called=false;for(let i=0;i<8;i++){const parsed=extractApexWake(rest);if(!parsed.called)return false;called=true;rest=parsed.message;if(!rest)return called;}return false;}
