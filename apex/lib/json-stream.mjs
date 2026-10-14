// Bounded NDJSON reader shared by the local provider and browser conversation transport.
export async function* jsonLines(body, signal, maxBytes = 1000000) {
 if (!body) throw new Error('Response stream is missing.');
 const reader=body.getReader(),decoder=new TextDecoder();let buffer='',bytes=0;
 try { for (;;) {
  signal?.throwIfAborted();const {done,value}=await reader.read();
  if(value){bytes+=value.byteLength;if(bytes>maxBytes)throw new Error('Response stream exceeded its limit.');buffer+=decoder.decode(value,{stream:true});}
  if(done)buffer+=decoder.decode();
  let index;while((index=buffer.indexOf('\n'))!==-1){const line=buffer.slice(0,index).trim();buffer=buffer.slice(index+1);if(line)yield JSON.parse(line);}
  if(buffer.length>65536)throw new Error('Response stream record is too large.');
  if(done){if(buffer.trim())yield JSON.parse(buffer);break;}
 }} finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
}
