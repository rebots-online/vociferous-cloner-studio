import * as ort from 'onnxruntime-web/webgpu';
import { SAMPLING } from './chatterboxModel';
import type { TensorMap } from './chatterboxTypes';

export function chooseSpeechToken(logits: Float32Array, generated: number[], tuning:import('./chatterboxTypes').GenerationTuning=SAMPLING): number {
  const scores = logits.slice(-6563);
  const seen = new Set(generated);
  const ranked: number[] = [];
  let maximum = -Infinity;
  for (let token = 0; token < scores.length; token++) {
    if (!Number.isFinite(scores[token])) continue;
    if (seen.has(token)) scores[token] = scores[token] < 0 ? scores[token] * tuning.repetitionPenalty : scores[token] / tuning.repetitionPenalty;
    scores[token] /= tuning.temperature;
    ranked.push(token);
  }
  ranked.sort((left, right) => scores[right] - scores[left] || left - right);
  ranked.length = Math.min(ranked.length, tuning.topK);
  if (!ranked.length) throw new Error('No finite speech-token probabilities.');
  maximum = scores[ranked[0]];
  const weights: number[] = [];
  let total = 0;
  for (let index = 0; index < ranked.length; index++) { weights.push(Math.exp(scores[ranked[index]] - maximum)); total += weights[index]; }
  let cumulative = 0;
  let retained = 0;
  while (retained < weights.length && cumulative < total * tuning.topP) cumulative += weights[retained++];
  let draw = Math.random() * cumulative;
  for (let index = 0; index < retained; index++) { draw -= weights[index]; if (draw <= 0) return ranked[index]; }
  return ranked[retained - 1];
}
export function int64(values: readonly number[], dims: number[]): ort.Tensor {
  const data = new BigInt64Array(values.length);
  for (let index = 0; index < values.length; index++) data[index] = BigInt(values[index]);
  return new ort.Tensor('int64', data, dims);
}
export function disposeTensors(values: TensorMap): void { for (const tensor of Object.values(values)) tensor.dispose(); }
export function halfToFloat(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1;
  const exponent = bits >> 10 & 31;
  const mantissa = bits & 1023;
  return sign * (exponent === 0 ? mantissa * 2 ** -24 : exponent === 31 ? mantissa ? NaN : Infinity : (1 + mantissa / 1024) * 2 ** (exponent - 15));
}
