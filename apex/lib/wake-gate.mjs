import {extractApexWake} from './wake-phrase.mjs';

// A wake-only call opens a short request window. Background speech never
// reaches conversation handlers. Each submitted request closes the window.
export class WakeGate {
 constructor({now=()=>Date.now(),windowMs=20000}={}){this.now=now;this.windowMs=windowMs;this.until=0;}
 get active(){return this.now()<this.until;}
 observe(text){const wake=extractApexWake(text);if(wake.called)this.until=this.now()+this.windowMs;return wake.called||this.active;}
 consume(text){const wake=extractApexWake(text);if(!wake.called&&!this.active)return null;if(!wake.message){if(wake.called)this.until=this.now()+this.windowMs;return wake.called?text:null;}this.until=0;return text;}
 reset(){this.until=0;}
}
