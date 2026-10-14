// A half-duplex browser voice controller: assistant audio is never listened to.
export class VoiceController {
  constructor({ recognitionFactory, synth, utteranceFactory, onTranscript, onState, onSend, onError, onMic }) {
    Object.assign(this, { recognitionFactory, synth, utteranceFactory, onTranscript, onState, onSend, onError, onMic });
    this.enabled = false; this.busy = false; this.speaking = false; this.paused = false; this.active = false;
    this.buffer = ''; this.prefix = ''; this.language = 'en-GB'; this.readAloud = true; this.cooldown = 0;
    this.timer = null; this.restart = null; this.recognition = null; this.finishSpeech = null; this.speechGeneration = 0;
  }
  emit() { this.onMic?.({ enabled: this.enabled, paused: this.paused, supported: Boolean(this.recognitionFactory) }); }
  clearTimer() { clearTimeout(this.timer); this.timer = null; }
  stopRecognition() { clearTimeout(this.restart); this.restart = null; if (this.active) { this.active = false; try { this.recognition?.abort(); } catch {} } }
  start() {
    if (!this.enabled || this.busy || this.speaking || this.paused || this.active) return;
    if (!this.recognitionFactory) { this.enabled = false; this.onError?.('Dictation is not supported in this browser. Use text input.'); this.emit(); return; }
    if (Date.now() < this.cooldown) { clearTimeout(this.restart); this.restart = setTimeout(() => this.start(), this.cooldown - Date.now()); return; }
    if (!this.recognition) {
      const recognition = this.recognitionFactory(); this.recognition = recognition;
      recognition.continuous = true; recognition.interimResults = true;
      recognition.onstart = () => { if (!this.enabled || this.busy || this.speaking || this.paused) { recognition.abort(); return; } this.active = true; this.onState?.('listening'); };
      recognition.onspeechstart = () => this.clearTimer();
      recognition.onresult = event => {
        if (!this.enabled || this.busy || this.speaking || this.paused || Date.now() < this.cooldown) return;
        const words = Array.from(event.results).map(result => result[0]?.transcript || '').join(' ').trim();
        this.buffer = `${this.prefix} ${words}`.trim(); this.onTranscript?.(this.buffer); this.clearTimer();
        if (this.buffer) this.timer = setTimeout(() => { const message = this.buffer.replace(/^apex[\s,.!:]*/i, '').trim(); if (!message) { this.cancel(); return; } this.beginTurn(); this.onSend?.(message); }, 2500);
      };
      recognition.onend = () => { this.active = false; if (this.enabled && !this.busy && !this.speaking && !this.paused) { clearTimeout(this.restart); this.restart = setTimeout(() => this.start(), 350); } };
      recognition.onerror = event => {
        if (event.error === 'aborted' || event.error === 'no-speech') return;
        this.paused = true; this.clearTimer(); this.stopRecognition();
        if (['not-allowed', 'service-not-allowed'].includes(event.error)) this.enabled = false;
        this.onError?.(`Microphone ${event.error || 'failed'}. Use Resume microphone or text input.`); this.onState?.('idle'); this.emit();
      };
    }
    this.prefix = this.buffer; this.recognition.lang = this.language;
    try { this.active = true; this.recognition.start(); }
    catch { this.active = false; this.paused = true; this.onError?.('Automatic listening was blocked. Click Resume microphone.'); this.emit(); }
  }
  enable() { this.enabled = true; this.paused = false; this.emit(); this.start(); }
  disable() { this.enabled = false; this.paused = false; this.clearTimer(); this.stopRecognition(); this.onState?.(this.speaking ? 'speaking' : this.busy ? 'thinking' : 'idle'); this.emit(); }
  resume() { this.paused = false; this.enabled = true; this.emit(); this.start(); }
  edit(value) { this.buffer = value; this.clearTimer(); if (this.enabled) { this.paused = true; this.clearTimer(); this.stopRecognition(); this.onState?.('idle'); this.emit(); } }
  cancel() { this.buffer = ''; this.prefix = ''; this.clearTimer(); this.onTranscript?.(''); this.paused = false; this.emit(); this.start(); }
  beginTurn() { this.busy = true; this.clearTimer(); this.stopRecognition(); this.stopSpeaking(); this.busy = true; this.buffer = ''; this.prefix = ''; this.onTranscript?.(''); this.onState?.('thinking'); }
  endTurn() { this.busy = false; if (!this.speaking) { this.onState?.('idle'); this.start(); } }
  stopSpeaking() { this.speechGeneration++; this.synth?.cancel(); this.finishSpeech?.(); this.finishSpeech = null; this.speaking = false; this.cooldown = Date.now() + 750; if (!this.busy) { this.onState?.('idle'); this.start(); } }
  async speak(value) {
    if (!this.readAloud || !this.synth || !this.utteranceFactory || !value?.trim()) return;
    this.stopSpeaking(); this.stopRecognition(); this.clearTimer(); this.speaking = true;
    const generation = this.speechGeneration;
    const clean = value.replace(/[#*_`]/g, '').trim();
    const chunks = clean.match(/.{1,220}(?:\s|$)|.{1,220}/gs) || [clean];
    for (const chunk of chunks) {
      if (generation !== this.speechGeneration) break;
      await new Promise(resolve => {
        const utterance = this.utteranceFactory(chunk);
        utterance.lang = this.language;
        const voices = this.synth.getVoices?.() || [];
        const voice = voices.find(v => v.lang === this.language) || voices.find(v => v.lang?.startsWith(this.language.slice(0, 2)));
        if (voice) utterance.voice = voice;
        let done = false;
        const finish = () => { if (done) return; done = true; clearTimeout(watchdog); if (this.finishSpeech === finish) this.finishSpeech = null; resolve(); };
        const watchdog = setTimeout(() => { if (generation !== this.speechGeneration) { finish(); return; } this.speechGeneration++; this.synth.cancel(); this.onError?.('Speech playback did not finish. Use Stop speaking or Resume microphone.'); finish(); }, 8000 + chunk.length * 90);
        this.finishSpeech = finish;
        utterance.onstart = () => { if (generation === this.speechGeneration && this.speaking) this.onState?.('speaking'); };
        utterance.onend = finish;
        utterance.onerror = () => { if (generation === this.speechGeneration) { this.speechGeneration++; this.onError?.('Speech playback was unavailable. The reply is visible in chat.'); } finish(); };
        try { this.synth.speak(utterance); } catch { this.speechGeneration++; this.onError?.('Speech playback could not start.'); finish(); }
      });
    }
    if (generation === this.speechGeneration) { this.speaking = false; this.cooldown = Date.now() + 750; this.onState?.(this.busy ? 'thinking' : 'idle'); if (!this.busy) this.start(); }
    else { this.speaking = false; this.cooldown = Date.now() + 750; this.onState?.(this.busy ? 'thinking' : 'idle'); if (!this.busy) this.start(); }
  }
  dispose() { this.enabled = false; this.clearTimer(); this.stopRecognition(); this.stopSpeaking(); }
}
