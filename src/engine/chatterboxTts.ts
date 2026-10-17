import { voiceMeasurements } from './voiceMeasurements';
import { LIMITS, CHATTERBOX_REVISION } from './chatterboxModel';
import type { LocalSpeech, PendingRequest, SpeechUnit, VoiceId, VoiceStatus, WorkerMessage, WorkerPayload } from './chatterboxTypes';
export type { VoiceStatus, VoiceGraphProgress, LocalSpeech } from './chatterboxTypes';

let status: VoiceStatus = { phase: 'idle', message: '' };
const listeners = new Set<(value: VoiceStatus) => void>();
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, PendingRequest>();
const preloads = new Map<VoiceId, Promise<void>>();
let selectedVoice: VoiceId = 'F4';
let forceWasm = false;
let lastAcknowledgedAt = 0;
let foregroundEpoch = 0;
let idleEpoch = 0;

export function reportVoiceStatus(value: VoiceStatus): void {
  status = value.phase === 'error' ? { ...status, ...value } : value;
  for (const listener of listeners) listener(status);
}
export function subscribeVoiceStatus(listener: (value: VoiceStatus) => void): () => void {
  listeners.add(listener); listener(status);
  return () => { listeners.delete(listener); };
}
function resetWorker(message: string): void {
  worker?.terminate(); worker = null;
  for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error(message)); }
  pending.clear(); preloads.clear();
  reportVoiceStatus({ ...status, phase: 'error', message });
}
function expireWorker(): void { resetWorker('Local voice stopped reporting measured work. ' + status.message); }
function handleWorkerFailure(event: Event | MessageEvent<unknown>): void {
  if (event.currentTarget !== worker) return;
  resetWorker(event instanceof ErrorEvent && event.message ? event.message : 'Local voice worker failed during ' + status.message);
}
function handleWorkerMessage(event: MessageEvent<WorkerMessage>): void {
  if (event.currentTarget !== worker) return;
  const data = event.data;
  if ('measurement' in data) { voiceMeasurements.record(data.measurement); return; }
  if ('heartbeat' in data) { reportVoiceStatus({ ...status, heartbeatAt: data.heartbeat }); return; }
  if ('status' in data) {
    if (Number.isFinite(data.status.confirmedAt) && data.status.confirmedAt! > lastAcknowledgedAt) {
      lastAcknowledgedAt = data.status.confirmedAt!;
      for (const waiting of pending.values()) { clearTimeout(waiting.timer); waiting.timer = setTimeout(expireWorker, LIMITS.inactivityMs); }
    }
    reportVoiceStatus({ heartbeatAt: status.heartbeatAt, ...data.status }); return;
  }
  const request = pending.get(data.id);
  if (!request) return;
  if (data.kind === 'cancelled') {
    clearTimeout(request.timer); pending.delete(data.id);
    request.reject(new DOMException('Speech interrupted.', 'AbortError')); return;
  }
  if (data.kind === 'failed') {
    if (data.inputRejected) { clearTimeout(request.timer); pending.delete(data.id); request.reject(new Error(data.message)); return; }
    if (data.runtimeFailed && data.backend === 'webgpu') forceWasm = true;
    resetWorker(data.message); return;
  }
  clearTimeout(request.timer); pending.delete(data.id); request.resolve(data);
}
function requestWorker(payload: WorkerPayload): Promise<WorkerMessage> {
  if (payload.kind !== 'preload' && !(payload.kind === 'speak' && payload.priority === 'idle')) cancelChatterbox('idle');
  if (!worker) {
    try {
      worker = new Worker(new URL('./chatterbox.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = handleWorkerMessage;
      worker.onerror = handleWorkerFailure;
      worker.onmessageerror = handleWorkerFailure;
    } catch (error) { return Promise.reject(error); }
  }
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(expireWorker, LIMITS.inactivityMs);
    pending.set(id, { kind: payload.kind, priority: payload.kind === 'speak' && payload.priority === 'idle' ? 'idle' : 'foreground', resolve, reject, timer });
    try { worker!.postMessage({ id, ...payload }); }
    catch (error) { resetWorker(error instanceof Error ? error.message : 'Local voice could not receive the request.'); }
  });
}
export function initChatterbox(voice: VoiceId): Promise<void> {
  selectedVoice = voice;
  let preload = preloads.get(voice);
  if (!preload) {
    preload = requestWorker({ kind: 'preload', voice, forceWasm }).then(message => {
      if (!('kind' in message) || message.kind !== 'preloaded') throw new Error('Local voice did not confirm readiness.');
    }).catch(error => { if (preloads.get(voice) === preload) preloads.delete(voice); throw error; });
    preloads.set(voice, preload);
  }
  return preload;
}
export async function planChatterboxSpeech(text: string, voice: VoiceId): Promise<SpeechUnit[]> {
  const epoch = foregroundEpoch;
  await initChatterbox(voice);
  if (epoch !== foregroundEpoch) throw new DOMException('Speech interrupted.', 'AbortError');
  const message = await requestWorker({ kind: 'plan', text, voice, forceWasm });
  if (!('kind' in message) || message.kind !== 'planned') throw new Error('Local voice returned no sentence plan.');
  return message.units;
}
export async function chatterboxSpeak(text: string, options: { voice: VoiceId; speed: number; priority?: 'foreground' | 'idle' }): Promise<LocalSpeech> {
  const epoch = options.priority === 'idle' ? idleEpoch : foregroundEpoch;
  await initChatterbox(options.voice);
  if (epoch !== (options.priority === 'idle' ? idleEpoch : foregroundEpoch)) throw new DOMException('Speech interrupted.', 'AbortError');
  const message = await requestWorker({ kind: 'speak', text, ...options, forceWasm });
  if (!('kind' in message) || message.kind !== 'spoken') throw new Error('Local voice returned no speech.');
  if (!message.audio.samples.length || !Number.isFinite(message.audio.sampleRate) || message.audio.sampleRate <= 0) throw new Error('Local voice returned invalid audio.');
  for (const sample of message.audio.samples) if (!Number.isFinite(sample)) throw new Error('Local voice returned invalid PCM.');
  return message.audio;
}
export function cancelChatterbox(priority?: 'idle'): void {
  idleEpoch++;
  if (!priority) foregroundEpoch++;
  const ids: number[] = [];
  for (const [id, request] of pending) if (request.kind !== 'preload' && (!priority || request.priority === priority)) {
    ids.push(id); clearTimeout(request.timer); pending.delete(id);
    request.reject(new DOMException('Speech interrupted.', 'AbortError'));
  }
  if (ids.length) worker?.postMessage({ kind: 'cancel', ids });
}

export async function configurePreview(samples:Float32Array|null,tuning:import('./chatterboxTypes').GenerationTuning):Promise<void> {
  cancelChatterbox();
  const message=await requestWorker({kind:'preview-config',voice:'F4',forceWasm,samples,tuning});
  if(!('kind' in message)||message.kind!=='preview-configured')throw Error('Reference configuration not confirmed');
  preloads.delete('F4');
}
