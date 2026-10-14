export function isSystemCheckCommand(text){return /^(?:(?:apex|nova)[,\s]+)?(?:please\s+)?(?:system check|(?:run|start)(?: a)? system check|check your system)[.!?]*$/i.test(text.trim());}
export function diagnosticAnnouncement(report){
  if(report.state!=='completed')throw new Error('A completed diagnostic report is required.');
  const passed=report.checks.filter(c=>c.state==='passed').length,failed=report.checks.filter(c=>c.state==='failed'),skipped=report.checks.filter(c=>c.state==='skipped').length;
  return (`System check complete, Idham. ${passed} of ${report.checks.length} checks passed. `+(failed.length?`${failed.length} problem${failed.length===1?'':'s'} found. ${failed.slice(0,3).map(c=>`${c.label}: ${c.detail.slice(0,220)}`).join('. ')}. `:'')+(skipped?`${skipped} check${skipped===1?' was':'s were'} skipped. `:'')+'This verifies local software checks. Model generation, voice connections and external actions need separate verification.').slice(0,1500);
}
export async function consumeCheckStream(response,onReport,signal){
  if(!response.ok){let body;try{body=await response.json();}catch{}throw new Error(body?.error||'System check connection failed.');}
  const reader=response.body?.getReader();if(!reader)throw new Error('System check returned no event stream.');
  const decoder=new TextDecoder();let buffer='',final=null;
  try{for(;;){if(signal?.aborted)throw new DOMException('Check display stopped.','AbortError');const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});if(buffer.length>250000)throw new Error('System check event exceeds its limit.');
    let separator;while((separator=/\r?\n\r?\n/.exec(buffer))){const frame=buffer.slice(0,separator.index);buffer=buffer.slice(separator.index+separator[0].length);const data=frame.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data)continue;const event=JSON.parse(data);if(event.type==='error')throw new Error(event.error||'System check failed.');if(event.type!=='report')continue;const report=event.report;if(!report||!Array.isArray(report.checks)||report.checks.length>30)throw new Error('Invalid system check report.');onReport(report);if(report.state==='completed')final=report;}
  }}finally{reader.releaseLock();}
  if(!final)throw new Error('Connection ended before the system check completed.');return final;
}
