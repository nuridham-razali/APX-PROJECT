export async function voiceRequest(path, body, token, signal) {
  if (!['status','transcribe','speak'].includes(path)) throw new Error('Unknown local voice operation.');
  const response = await fetch(`http://127.0.0.1:8082/${path}`, {method:path==='status'?'GET':'POST',headers:{'Content-Type':'application/json','x-apex-token':token},body:path==='status'?undefined:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)}).catch(()=>{throw new Error('Local voice is unavailable. Start the Whisper/Piper voice service.');});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Local voice failed.');
  return result;
}
