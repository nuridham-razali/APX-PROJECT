class ApexPcm extends AudioWorkletProcessor {
  constructor(options={}){
    super();
    this.inputRate=Number(options.processorOptions?.inputSampleRate)||16000;
    this.samples=new Int16Array(2560);this.used=0;
    this.source=[];this.position=0;this.output=[];this.step=this.inputRate/16000;
  }
  emit(samples){
    const buffer=new ArrayBuffer(samples.length*2),view=new DataView(buffer);
    for(let i=0;i<samples.length;i++)view.setInt16(i*2,samples[i],true);
    this.port.postMessage(buffer,[buffer]);
  }
  process(inputs){
    const input=inputs[0]?.[0];if(!input)return true;
    // Keep the original low-latency path when the browser already provides 16 kHz.
    if(this.inputRate===16000){
      for(const sample of input){const value=Math.max(-1,Math.min(1,sample));this.samples[this.used++]=Math.round(value*(value<0?32768:32767));if(this.used===this.samples.length){
        this.emit(this.samples);this.used=0;
      }}return true;
    }
    // Windows audio devices normally run at 48 kHz. Convert to the 16 kHz
    // linear PCM stream required by Deepgram Flux instead of rejecting the mic.
    for(const sample of input)this.source.push(sample);
    while(this.position+1<this.source.length){
      const index=Math.floor(this.position),fraction=this.position-index;
      const value=this.source[index]+(this.source[index+1]-this.source[index])*fraction;
      const clamped=Math.max(-1,Math.min(1,value));
      this.output.push(Math.round(clamped*(clamped<0?32768:32767)));
      this.position+=this.step;
    }
    const consumed=Math.floor(this.position);
    if(consumed>0){this.source.splice(0,consumed);this.position-=consumed;}
    while(this.output.length>=2560)this.emit(this.output.splice(0,2560));
    return true;
  }
}
registerProcessor('apex-pcm',ApexPcm);
