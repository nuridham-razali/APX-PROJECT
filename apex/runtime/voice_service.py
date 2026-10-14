"""Authenticated loopback-only Whisper/Piper service. Audio is not saved."""
import base64, hmac, io, json, os, threading, wave, time
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from faster_whisper import WhisperModel
from piper import PiperVoice

root = Path(__file__).resolve().parents[1]
data = Path(os.environ.get('APEX_DATA_DIR', root / '.apex-data'))
for _ in range(100):
    if (data / 'runtime-token').exists(): break
    time.sleep(.1)
token = (data / 'runtime-token').read_text().strip()
models = root / '.apex-data' / 'voice-models'
whisper = WhisperModel(str(models / 'whisper-base'), device='cpu', compute_type='int8', cpu_threads=4, local_files_only=True)
piper = PiperVoice.load(str(models / 'en_US-lessac-medium.onnx'))
recognition_lock, speech_lock = threading.Lock(), threading.Lock()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def send_json(self, status, value):
        encoded = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)
    def authorized(self):
        return hmac.compare_digest(self.headers.get('x-apex-token',''), token)
    def do_GET(self):
        if not self.authorized(): return self.send_json(401, {'error':'Local voice access denied.'})
        if self.path != '/status': return self.send_json(404, {'error':'Unknown voice operation.'})
        self.send_json(200, {'ready':True,'recognition':'Whisper base / CPU int8','speech':'Piper Lessac / English','local':True})
    def do_POST(self):
        if not self.authorized(): return self.send_json(401, {'error':'Local voice access denied.'})
        try:
            size = int(self.headers.get('Content-Length','0'))
            if size < 1 or size > 4000000: return self.send_json(413, {'error':'Voice request exceeds 4 MB.'})
            body = json.loads(self.rfile.read(size))
            if self.path == '/transcribe':
                audio = base64.b64decode(body.get('audio',''), validate=True)
                if not audio or len(audio) > 2800000: raise ValueError('Invalid audio length.')
                with recognition_lock:
                    segments, info = whisper.transcribe(io.BytesIO(audio), language={'English':'en','Malay':'ms','中文':'zh'}.get(body.get('language')), beam_size=3, vad_filter=True)
                    text = ' '.join(s.text.strip() for s in segments).strip()
                return self.send_json(200, {'text':text,'language':info.language})
            if self.path == '/speak':
                text = body.get('text','')
                if not isinstance(text,str) or not 1 <= len(text.strip()) <= 1500: raise ValueError('Speech text must contain 1–1500 characters.')
                output = io.BytesIO()
                with speech_lock:
                    with wave.open(output,'wb') as wav: piper.synthesize_wav(text, wav)
                return self.send_json(200, {'audio':base64.b64encode(output.getvalue()).decode(),'mime':'audio/wav','voice':'Lessac'})
            self.send_json(404, {'error':'Unknown voice operation.'})
        except (ValueError,TypeError): self.send_json(400, {'error':'Invalid local voice request.'})
        except Exception: self.send_json(502, {'error':'Local voice processing failed. Check the voice service console.'})

print('APEX local voice ready on 127.0.0.1:8082 (Whisper + Piper)', flush=True)
ThreadingHTTPServer(('127.0.0.1',8082), Handler).serve_forever()
