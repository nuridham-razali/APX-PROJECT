"use client";
import { useEffect, useRef, useState } from 'react';
import { VoiceController } from '@/lib/voice-controller.mjs';
import type { OrbState } from './ApexHeroOrb';
export type VoiceAPI = { beginTurn: () => void; endTurn: () => void; speak: (text: string) => Promise<void>; edit: (text: string) => void; cancel: () => void };
type Recognition = { start: () => void; abort: () => void; continuous: boolean; interimResults: boolean; lang: string; onstart: (() => void) | null; onspeechstart: (() => void) | null; onresult: ((event: { results: { [index: number]: { transcript: string } }[] }) => void) | null; onend: (() => void) | null; onerror: ((event: { error: string }) => void) | null };
export default function VoiceChat({ language, onState, onTranscript, onSend, onReady, onStatus }: { language: string; onState: (state: OrbState) => void; onTranscript: (text: string) => void; onSend: (text: string) => void; onReady: (api: VoiceAPI | null) => void; onStatus?: (status: string) => void }) {
  const [mic, setMic] = useState({ enabled: false, paused: false, supported: false });
  const [consent, setConsent] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [readAloud, setReadAloud] = useState(true);
  const [error, setError] = useState('');
  const controller = useRef<InstanceType<typeof VoiceController> | null>(null);
  const callbacks = useRef({ onState, onTranscript, onSend, onReady, onStatus }); callbacks.current = { onState, onTranscript, onSend, onReady, onStatus };
  useEffect(() => {
    const browser = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    const instance = new VoiceController({ recognitionFactory: Constructor ? () => new Constructor() : null, synth: window.speechSynthesis, utteranceFactory: typeof SpeechSynthesisUtterance === 'undefined' ? null : (text: string) => new SpeechSynthesisUtterance(text), onState: (state: OrbState) => callbacks.current.onState(state), onTranscript: (text: string) => callbacks.current.onTranscript(text), onSend: (text: string) => callbacks.current.onSend(text), onError: (message: string) => setError(message), onMic: setMic });
    controller.current = instance; instance.emit(); callbacks.current.onReady(instance);
    return () => { instance.dispose(); callbacks.current.onReady(null); };
  }, []);
  useEffect(() => { if (controller.current) controller.current.language = language === 'Malay' ? 'ms-MY' : language === '中文' ? 'zh-CN' : 'en-GB'; }, [language]);
  useEffect(() => { if (controller.current) { controller.current.readAloud = readAloud; if (!readAloud) controller.current.stopSpeaking(); } }, [readAloud]);
  useEffect(() => { callbacks.current.onStatus?.(error ? 'Needs attention' : `${mic.enabled ? mic.paused ? 'Mic paused' : 'Mic on' : 'Mic off'} · replies ${readAloud ? 'on' : 'off'}`); }, [mic, readAloud, error]);
  return <div className="voice-controls">
    <button onClick={() => { setError(''); if (mic.enabled) controller.current?.disable(); else if (consent) controller.current?.enable(); else setShowConsent(true); }} aria-pressed={mic.enabled}>{mic.enabled ? 'Microphone off' : 'Enable microphone'}</button>
    {mic.paused && consent && <button onClick={() => { setError(''); controller.current?.resume(); }}>Resume microphone</button>}
    <button onClick={() => controller.current?.stopSpeaking()}>Stop speaking</button>
    <label><input type="checkbox" checked={readAloud} onChange={e => setReadAloud(e.target.checked)} />Read replies aloud</label>
    <span className="voice-caption">{mic.enabled ? mic.paused ? 'MIC PAUSED' : 'MIC ON · 2.5s silence sends' : 'MIC OFF'} · {mic.supported ? 'Browser dictation' : 'Dictation unavailable'}</span>
    {showConsent && <div className="voice-consent"><p>Browser dictation may send your microphone audio to the browser provider for processing. It may require internet. Speech playback uses your browser's available voices. APEX pauses dictation during replies and playback.</p><label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I agree to use browser dictation.</label><button disabled={!consent || !mic.supported} onClick={() => { setShowConsent(false); controller.current?.enable(); }}>Turn on microphone</button><button onClick={() => { setShowConsent(false); setConsent(false); }}>Keep microphone off</button></div>}
    {error && <span role="alert" className="voice-error">{error}</span>}
  </div>;
}
