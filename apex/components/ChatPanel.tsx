"use client";
import { FormEvent, useEffect, useRef, useState } from 'react';
import VoiceChat, { type VoiceAPI } from './VoiceChat';
import type { PersonalityValues } from './PersonalityPanel';
type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };
const CONVERSATION_KEY = 'apex.local.conversation';
export default function ChatPanel({ onActivity, personality, language, onWorkspace, onSystemCheck, onVoiceReady, onVoiceStatus }: { onActivity?: (state: 'idle' | 'listening' | 'thinking' | 'speaking') => void; personality: PersonalityValues; language: string; onWorkspace?: (name: string) => void; onSystemCheck?: () => Promise<string>; onVoiceReady?: (api: VoiceAPI | null) => void; onVoiceStatus?: (status: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sending = useRef(false);
  const voice = useRef<VoiceAPI | null>(null);
  const sendRef = useRef<(text: string) => void>(() => {});
  useEffect(() => { inputRef.current?.focus(); try { const saved = JSON.parse(localStorage.getItem('apex.chat.messages') || '[]'); if (Array.isArray(saved)) setMessages(saved.filter(m => typeof m.text === 'string' && ['user', 'assistant'].includes(m.role)).slice(-60)); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem('apex.chat.messages', JSON.stringify(messages.slice(-60))); } catch {} scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages, pending]);
  const send = async (event?: FormEvent, spoken?: string) => {
    event?.preventDefault(); const message = (spoken || input).trim(); if (!message || sending.current) return;
    sending.current = true; voice.current?.beginTurn(); setInput(''); setError(''); setElapsed(null); setPending(true); onActivity?.('thinking');
    setMessages(m => [...m, { id: crypto.randomUUID(), role: 'user', text: message }]);
    try {
      const match = /^(?:open|show)\s+(loops|tasks|memory)(?:\s+workspace)?$/i.exec(message);
      let reply;
      if (/^(?:apex[, ]*)?(?:run )?system checks?[.!]?$/i.test(message) && onSystemCheck) { reply = await onSystemCheck(); }
      else if (match) { onWorkspace?.(match[1].toLowerCase()); reply = `Opened ${match[1].toLowerCase()}.`; }
      else {
        let conversationId = ''; try { conversationId = localStorage.getItem(CONVERSATION_KEY) || ''; } catch {}
        const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, conversationId, personality, language }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'APEX could not complete this request.');
        if (data.conversationId) try { localStorage.setItem(CONVERSATION_KEY, data.conversationId); } catch {}
        setElapsed(data.elapsedMs ?? null); reply = String(data.message || '');
      }
      setMessages(m => [...m, { id: crypto.randomUUID(), role: 'assistant', text: reply }]);
      await voice.current?.speak(reply);
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.'); }
    finally { sending.current = false; setPending(false); voice.current?.endTurn(); if (!voice.current) onActivity?.('idle'); inputRef.current?.focus(); }
  };
  sendRef.current = (text: string) => { void send(undefined, text); };
  const newConversation = () => { if (sending.current) return; try { localStorage.removeItem(CONVERSATION_KEY); } catch {} setMessages([]); setInput(''); setError(''); setElapsed(null); inputRef.current?.focus(); };
  return <section aria-label="APEX chat" className="apex-chat-panel">
    <div className="apex-chat-header"><div><div className="apex-chat-kicker">APEX COMMUNICATION</div><div className="apex-chat-title">CONVERSATION · {language.toUpperCase()}</div></div><button type="button" disabled={pending} onClick={newConversation} className="apex-chat-new">NEW</button></div>
    <div ref={scrollRef} className="apex-chat-messages" aria-live="polite">
      {!messages.length && <div className="apex-chat-empty">Send a message, or use /task, /tasks, /remember and /recall. Background jobs run separately. Type “system check”, or enable microphone after reviewing the voice notice.</div>}
      {messages.map(m => <div key={m.id} className={`apex-chat-message ${m.role}`}><span className="apex-chat-role">{m.role === 'user' ? 'YOU' : 'APEX'}</span><span>{m.text}</span></div>)}
      {pending && <div className="apex-chat-message assistant"><span>APEX · Processing this turn…</span></div>}
      {error && <div className="apex-chat-error" role="alert">{error}</div>}
    </div>
    {elapsed !== null && <div className="chat-timing">Last turn: {(elapsed / 1000).toFixed(2)}s · browser voice controls below</div>}
    <form onSubmit={send} className="apex-chat-form"><input ref={inputRef} value={input} onChange={e => { setInput(e.target.value); voice.current?.edit(e.target.value); }} aria-label="Message APEX" placeholder={`Message APEX in ${language}…`} autoComplete="off" maxLength={16000} /><button type="submit" disabled={pending || !input.trim()}>SEND</button>{input && <button type="button" onClick={() => { setInput(''); voice.current?.cancel(); }}>Cancel</button>}</form>
    <VoiceChat onStatus={onVoiceStatus} language={language} onState={state => onActivity?.(state)} onTranscript={setInput} onSend={text => sendRef.current(text)} onReady={api => { voice.current = api; onVoiceReady?.(api); }} />
  </section>;
}
