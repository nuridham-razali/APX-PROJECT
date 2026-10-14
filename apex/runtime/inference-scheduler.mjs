// Reserve admission for conversation; active Ollama calls cannot be preempted.
export class InferenceScheduler {
  constructor(generator, {limit=2,backgroundLimit=1}={}) {
    if(!Number.isInteger(limit)||limit<2||limit>3||!Number.isInteger(backgroundLimit)||backgroundLimit<1||backgroundLimit>=limit)throw new Error('Inference limits require 2–3 total slots and fewer background slots.');
    this.generator=generator;this.limit=limit;this.backgroundLimit=backgroundLimit;
    this.pending=[];this.active=new Set();this.closed=false;
  }
  status(){return {conversationPriority:true,limit:this.limit,backgroundLimit:this.backgroundLimit,activeForeground:[...this.active].filter(j=>j.priority==='foreground').length,activeBackground:[...this.active].filter(j=>j.priority==='background').length,waitingForeground:this.pending.filter(j=>j.priority==='foreground').length,waitingBackground:this.pending.filter(j=>j.priority==='background').length};}
  run(contents,instruction,{priority='background',...options}={}){
    if(!['foreground','background'].includes(priority))return Promise.reject(new Error('Unknown inference priority.'));
    if(this.closed)return Promise.reject(new Error('Inference scheduler is stopped.'));
    if(options.signal?.aborted)return Promise.reject(options.signal.reason);
    return new Promise((resolve,reject)=>{
      const controller=new AbortController();
      const job={contents,instruction,priority,options,resolve,reject,controller,abort:null};
      job.abort=()=>{
        controller.abort(options.signal.reason);
        const index=this.pending.indexOf(job);
        if(index!==-1){this.pending.splice(index,1);options.signal.removeEventListener('abort',job.abort);reject(options.signal.reason);this.drain();}
      };
      options.signal?.addEventListener('abort',job.abort,{once:true});
      this.pending.push(job);this.drain();
    });
  }
  drain(){
    if(this.closed)return;
    while(this.active.size<this.limit){
      let index=this.pending.findIndex(j=>j.priority==='foreground');
      if(index===-1&&[...this.active].filter(j=>j.priority==='background').length<this.backgroundLimit)index=this.pending.findIndex(j=>j.priority==='background');
      if(index===-1)return;
      const job=this.pending.splice(index,1)[0];this.active.add(job);
      // Reserve before calling. Active cancellation releases only on settlement.
      void Promise.resolve().then(()=>{job.controller.signal.throwIfAborted();return this.generator(job.contents,job.instruction,{...job.options,signal:job.controller.signal});})
        .then(value=>{job.controller.signal.throwIfAborted();job.resolve(value);},error=>job.reject(error))
        .catch(error=>job.reject(error))
        .finally(()=>{job.options.signal?.removeEventListener('abort',job.abort);this.active.delete(job);this.drain();});
    }
  }
  close(){
    this.closed=true;const reason=new Error('Inference scheduler stopped.');
    for(const job of this.pending.splice(0)){job.options.signal?.removeEventListener('abort',job.abort);job.reject(reason);}
    for(const job of this.active)job.controller.abort(reason);
  }
}
