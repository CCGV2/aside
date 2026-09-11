import { mkdir, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const vad = dirname(require.resolve('@ricky0123/vad-web'));
const ort = dirname(require.resolve('onnxruntime-web/wasm'));
const target = fileURLToPath(new URL('../frontend/public/vad/', import.meta.url));
await mkdir(target, { recursive: true });
for (const [root, file] of [
  [vad, 'vad.worklet.bundle.min.js'], [vad, 'silero_vad_v5.onnx'],
  [ort, 'ort-wasm-simd-threaded.mjs'], [ort, 'ort-wasm-simd-threaded.wasm'],
]) await copyFile(join(root, file), join(target, file));
console.log('Local VAD assets ready');
