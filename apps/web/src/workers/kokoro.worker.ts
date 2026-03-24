type Voice =
  | 'af_heart'
  | 'af_alloy'
  | 'af_aoede'
  | 'af_bella'
  | 'af_jessica'
  | 'af_kore'
  | 'af_nicole'
  | 'af_nova'
  | 'af_river'
  | 'af_sarah'
  | 'af_sky'
  | 'am_adam'
  | 'am_echo'
  | 'am_eric'
  | 'am_fenrir'
  | 'am_liam'
  | 'am_michael'
  | 'am_onyx'
  | 'am_puck'
  | 'am_santa'
  | 'bf_emma'
  | 'bf_isabella'
  | 'bm_george'
  | 'bm_lewis'
  | 'bf_alice'
  | 'bf_lily'
  | 'bm_daniel'
  | 'bm_fable'
  | undefined;
import { KokoroTTS } from 'kokoro-js';

let tts: KokoroTTS | null = null;
const queue: {
  text: string;
  voice: Voice;
  rawText: string;
  messageId: string;
}[] = [];
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;
  while (queue.length > 0) {
    const { text, voice, rawText, messageId } = queue.shift()!;
    const audio = await tts!.generate(text, { voice });
    const wav = audio.toWav();
    self.postMessage(
      { type: 'chunk', wav, sentence: rawText, messageId },
      { transfer: [wav] }
    );
  }
  processing = false;
  self.postMessage({ type: 'done' });
}

self.onmessage = async (e) => {
  const { type, text, rawText, voice, messageId } = e.data;

  if (type === 'init') {
    tts = await KokoroTTS.from_pretrained(
      'onnx-community/Kokoro-82M-v1.0-ONNX',
      {
        dtype: 'q8',
        device: 'wasm',
      }
    );
    self.postMessage({ type: 'ready' });
  }

  if (type === 'generate') {
    if (!tts) return;
    queue.push({ text, voice, rawText, messageId });
    processQueue();
  }
};
