import { KokoroTTS } from 'kokoro-js';

let tts: KokoroTTS | null = null;

self.onmessage = async (e) => {
  const { type, text, voice } = e.data;

  if (type === 'init') {
    tts = await KokoroTTS.from_pretrained(
      'onnx-community/Kokoro-82M-v1.0-ONNX',
      {
        dtype: 'q4',
        device: 'wasm',
      }
    );
    self.postMessage({ type: 'ready' });
  }

  if (type === 'generate') {
    if (!tts) return;
    const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
    for (const sentence of sentences) {
      const audio = await tts.generate(sentence.trim(), { voice });
      const wav = audio.toWav();
      self.postMessage({ type: 'chunk', wav }, { transfer: [wav] });
    }
    self.postMessage({ type: 'done' });
  }
};
