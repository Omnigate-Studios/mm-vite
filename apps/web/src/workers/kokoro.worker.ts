import { KokoroTTS } from 'kokoro-js';

let tts: KokoroTTS | null = null;

self.onmessage = async (e) => {
  const { type, text, voice } = e.data;

  if (type === 'init') {
    tts = await KokoroTTS.from_pretrained(
      'onnx-community/Kokoro-82M-v1.0-ONNX',
      {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (progress) => console.log(progress),
      }
    );
    self.postMessage({ type: 'ready' });
  }

  if (type === 'generate') {
    if (!tts) return;
    const audio = await tts.generate(text, { voice });
    const wav = audio.toWav();
    self.postMessage({ type: 'done', wav }, { transfer: [wav] });
  }
};
