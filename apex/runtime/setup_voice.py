"""Download the free local voice models once; runtime never downloads models."""
from pathlib import Path
from urllib.request import urlretrieve
from huggingface_hub import snapshot_download

root = Path(__file__).resolve().parents[1] / '.apex-data' / 'voice-models'
root.mkdir(parents=True, exist_ok=True)
print('Downloading multilingual Whisper base (local CPU int8)...', flush=True)
snapshot_download('Systran/faster-whisper-base', local_dir=root / 'whisper-base')
base = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/'
for name in ['en_US-lessac-medium.onnx', 'en_US-lessac-medium.onnx.json', 'MODEL_CARD']:
    dest = root / name
    if not dest.exists():
        print('Downloading Piper ' + name, flush=True)
        urlretrieve(base + name, dest)
print('Local Whisper and Piper models ready.', flush=True)
