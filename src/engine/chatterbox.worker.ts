import * as ort from 'onnxruntime-web/webgpu';

import { AutoTokenizer, env } from '@huggingface/transformers';

import { CHATTERBOX_MODEL, CHATTERBOX_REVISION, CHATTERBOX_FILES, GRAPH_PATHS, VOICE_REFERENCES, LIMITS, SAMPLING } from './chatterboxModel';

import { chooseSpeechToken, int64, disposeTensors, halfToFloat } from './chatterboxGeneration';

import { planSpeechUnits } from './speechUnits';

import type { VoiceMeasurement } from './voiceMeasurements';

import type { Backend, Engine, GraphRole, SpeechUnit, TensorMap, Tokenizer, VoiceFileProgress, VoiceGraphProgress, VoiceId, VoiceStatus, WebGpuNavigator, WorkerRequest, WorkerCommand } from './chatterboxTypes';



env.allowLocalModels = false;

env.useBrowserCache = true;

env.remotePathTemplate = '{model}/resolve/' + CHATTERBOX_REVISION + '/';

env.cacheKey = 'natally-chatterbox-' + CHATTERBOX_REVISION;

ort.env.wasm.numThreads = 1;

let engine: Promise<Engine> | null = null;

let queue = Promise.resolve();

let current: VoiceStatus = { phase: 'idle', message: '' };

let requestContext: { id: number; runId: string; started: number; workload: VoiceMeasurement['workload'] } = { id: 0, runId: '', started: 0, workload: 'preload' };

const graphs = new Map<string, VoiceGraphProgress>();

const files = new Map<string, VoiceFileProgress>();

const references = new Map<VoiceId, TensorMap>();

const clips = new Map<string, Float32Array>();

let clipBytes = 0;

const previewSamples=new Map<VoiceId,Float32Array>();

let previewSampling:import('./chatterboxTypes').GenerationTuning=SAMPLING;

let runtimeFailure = false;

const cancelled = new Set<number>();

let settledId = 0;



function status(phase: VoiceStatus['phase'], message: string, extra: Partial<VoiceStatus> = {}): void {

  current = { ...current, phase, message, ...extra };

  self.postMessage({ status: current });

}

function measure(event: Omit<VoiceMeasurement, 'runId' | 'revision' | 'atMs'>): void {

  self.postMessage({ measurement: { ...event, runId: requestContext.runId, revision: CHATTERBOX_REVISION, atMs: performance.now() - requestContext.started, workload: requestContext.workload } });

}

async function observe<T>(role: GraphRole, operation: 'session' | 'run', action: () => Promise<T>): Promise<T> {

  const key = operation + role;

  const started = performance.now();

  const previous = graphs.get(key);

  graphs.set(key, { file: GRAPH_PATHS[role], backend: current.graphs?.[0]?.backend || 'wasm', operation, state: 'start', completed: previous?.completed || 0, startedAt: Date.now(), ...(operation === 'session' ? { expected: 1 } : {}) });

  measure({ operation, state: 'start', file: GRAPH_PATHS[role], backend: graphs.get(key)!.backend });

  status(operation === 'session' ? 'preparing' : 'synthesizing', (operation === 'session' ? 'Initializing ' : 'Executing ') + GRAPH_PATHS[role], { graphs: [...graphs.values()], confirmedAt: Date.now() });

  try {

    const result = await action();

    graphs.get(key)!.state = 'complete'; graphs.get(key)!.completed++; graphs.get(key)!.durationMs = performance.now() - started;

    measure({ operation, state: 'complete', file: GRAPH_PATHS[role], backend: graphs.get(key)!.backend, durationMs: performance.now() - started });

    status(current.phase, GRAPH_PATHS[role] + ' completed', { graphs: [...graphs.values()], confirmedAt: Date.now() });

    return result;

  } catch (error) {

    if (error instanceof DOMException && error.name === 'AbortError') throw error;

    runtimeFailure = true;

    graphs.get(key)!.state = 'error'; graphs.get(key)!.durationMs = performance.now() - started;

    measure({ operation, state: 'error', file: GRAPH_PATHS[role], backend: graphs.get(key)!.backend, durationMs: performance.now() - started });

    throw error;

  }

}

async function loadBytes(file: keyof typeof CHATTERBOX_FILES): Promise<Uint8Array> {

  const spec = CHATTERBOX_FILES[file];

  const url = 'https://huggingface.co/' + CHATTERBOX_MODEL + '/resolve/' + CHATTERBOX_REVISION + '/' + file;

  const cache = await caches.open('natally-chatterbox-' + CHATTERBOX_REVISION);

  let saved = await cache.match(url);

  let response: Response;

  let reader: ReadableStreamDefaultReader<Uint8Array>;

  let part: ReadableStreamReadResult<Uint8Array>;

  let loaded = 0;

  let bytes: Uint8Array;

  let digest: ArrayBuffer;

  let hex = '';

  let source: 'cache' | 'network' = saved ? 'cache' : 'network';

  const started = performance.now();

  while (true) {

    response = saved || await fetch(url);

    if (!response.ok || !response.body) throw new Error(file + ': model request failed (' + response.status + ').');

    reader = response.body.getReader(); bytes = new Uint8Array(spec.bytes); loaded = 0;

    files.set(file, { file, loadedBytes: 0, totalBytes: spec.bytes, source });

    measure({ operation: 'file', state: 'start', file, source });

    while (true) {

      part = await reader.read(); if (part.done) break;

      if (loaded + part.value.length > bytes.length) { loaded += part.value.length; await reader.cancel(); break; }

      bytes.set(part.value, loaded); loaded += part.value.length;

      files.set(file, { file, loadedBytes: loaded, totalBytes: spec.bytes, source });

      status('loading', 'Reading ' + file + ' · ' + source, { file, files: [...files.values()], loadedBytes: [...files.values()].reduce((loaded, part) => loaded + part.loadedBytes, 0), totalBytes: Object.values(CHATTERBOX_FILES).reduce((loaded, spec) => loaded + spec.bytes, 0), confirmedAt: Date.now() });

    }

    digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>); hex = '';

    for (const byte of new Uint8Array(digest)) hex += byte.toString(16).padStart(2, '0');

    if (loaded === spec.bytes && hex === spec.sha256) break;

    if (!saved) throw new Error(file + ': incomplete or corrupt model file.');

    await cache.delete(url); saved = undefined; source = 'network';

  }

  if (!saved) {

    try { await cache.put(url, new Response(bytes as Uint8Array<ArrayBuffer>)); }

    catch (error) { throw new Error(file + ': browser could not save the voice model. ' + (error instanceof Error ? error.message : String(error))); }

  }

  measure({ operation: 'file', state: 'complete', file, source, bytes: loaded, durationMs: performance.now() - started });

  return bytes;

}

async function loadEngine(forceWasm: boolean): Promise<Engine> {

  if (!engine) engine = (async () => {

    ort.env.webgpu.powerPreference = 'high-performance';

    const adapter = forceWasm ? null : await (navigator as WebGpuNavigator).gpu?.requestAdapter({ powerPreference: 'high-performance' });

    const backend: Backend = adapter?.features.has('shader-f16') ? 'webgpu' : 'wasm';

    const sessions = {} as Engine['sessions'];

    try {

      for (const role of Object.keys(GRAPH_PATHS) as GraphRole[]) {

        const file = GRAPH_PATHS[role];

        const model = await loadBytes(file);

        const data = await loadBytes((file + '_data') as keyof typeof CHATTERBOX_FILES);

        status('preparing', 'Preparing Chatterbox Nano · ' + backend, { graphs: [{ file, backend, operation: 'session', state: 'start', completed: 0, startedAt: Date.now() }] });

        sessions[role] = await observe(role, 'session', () => ort.InferenceSession.create(model, {

          executionProviders: [backend],

          preferredOutputLocation: backend === 'webgpu' && role === 'language_model' ? 'gpu-buffer' : undefined,

          externalData: [{ path: file.slice(file.lastIndexOf('/') + 1) + '_data', data }],

        }));

      }

      for (const file of Object.keys(CHATTERBOX_FILES) as (keyof typeof CHATTERBOX_FILES)[]) if (!/^onnx\//.test(file)) await loadBytes(file);

      const tokenizer = await AutoTokenizer.from_pretrained(CHATTERBOX_MODEL, { revision: CHATTERBOX_REVISION });

      return { sessions, tokenizer, backend };

    } catch (error) {

      for (const session of Object.values(sessions)) await session.release();

      throw error;

    }

  })().catch(error => { engine = null; throw error; });

  return engine;

}

async function runGraph(engine: Engine, role: GraphRole, feeds: TensorMap): Promise<TensorMap> {

  await new Promise<void>(resolve => {

    const channel = new MessageChannel();

    channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };

    channel.port2.postMessage(null);

  });

  if (cancelled.has(requestContext.id)) throw new DOMException('Speech interrupted.', 'AbortError');

  const output = await observe(role, 'run', () => engine.sessions[role].run(feeds));

  if (cancelled.has(requestContext.id)) { disposeTensors(output); throw new DOMException('Speech interrupted.', 'AbortError'); }

  return output;

}

async function prepareReference(engine: Engine, voice: VoiceId): Promise<TensorMap> {

  if (!references.has(voice)) {

    let audio=previewSamples.get(voice);

    if(!audio){

    const spec = VOICE_REFERENCES[voice];

    const response = await fetch(import.meta.env.BASE_URL + spec.path);

    if (!response.ok) throw new Error('Reference voice unavailable: ' + voice);

    const wav = new DataView(await response.arrayBuffer());

    if (wav.byteLength !== spec.bytes || wav.getUint32(0, false) !== 0x52494646 || wav.getUint32(8, false) !== 0x57415645 || wav.getUint16(20, true) !== 1 || wav.getUint16(22, true) !== 1 || wav.getUint32(24, true) !== 24000 || wav.getUint16(34, true) !== 16 || wav.getUint32(36, false) !== 0x64617461) throw new Error('Invalid fixed reference voice: ' + voice);

    const count = Math.min((wav.byteLength - 44) / 2, LIMITS.referenceSamples);

    audio = new Float32Array(count);

    for (let index = 0; index < count; index++) audio[index] = wav.getInt16(44 + index * 2, true) / 32768;

    }

    const count=audio.length;

    const tensor = new ort.Tensor('float32', audio, [1, count]);

    try { const conditioning = await runGraph(engine, 'speech_encoder', { audio_values: tensor }); references.set(voice, conditioning); }

    finally { tensor.dispose(); }

  }

  return references.get(voice)!;

}

async function generateUnit(engine: Engine, text: string, reference: TensorMap): Promise<Float32Array> {

  const tokens = engine.tokenizer(text, { truncation: false, padding: false }).input_ids;

  let input: ort.Tensor = new ort.Tensor('int64', tokens.data as BigInt64Array, [...tokens.dims]);

  let cache: TensorMap = {};

  for (const meta of engine.sessions.language_model.inputMetadata) {

    if (!/^past_key_values\./.test(meta.name)) continue;

    if (!meta.isTensor || meta.type !== 'float16') throw new Error('Unexpected Nano KV-cache type.');

    cache[meta.name] = new ort.Tensor('float16', new Uint16Array(0), [1, 12, 0, 64]);

  }

  if (Object.keys(cache).length !== 24) throw new Error('Unexpected Nano KV-cache count.');

  let sequenceLength = 0; let first = true; let reachedEos = false;

  const generated: number[] = [SAMPLING.startToken];

  let all: number[] = [];

  try {

    for (let step = 0; step < LIMITS.speechTokens; step++) {

      const embedded = await runGraph(engine, 'embed_tokens', { input_ids: input }); input.dispose();

      let embeds = Object.values(embedded)[0];

      if (first) {

        const combined = new Float32Array(reference.audio_features.size + embeds.size);

        combined.set(reference.audio_features.data as Float32Array); combined.set(embeds.data as Float32Array, reference.audio_features.size);

        const length = reference.audio_features.dims[1] + embeds.dims[1]; embeds.dispose();

        embeds = new ort.Tensor('float32', combined, [1, length, 768]); sequenceLength = length;

      } else sequenceLength++;

      if (sequenceLength >= LIMITS.contextTokens) { embeds.dispose(); break; }

      const mask = int64(Array(sequenceLength).fill(1), [1, sequenceLength]);

      all = []; if (first) { for (let index = 0; index < sequenceLength; index++) all.push(index); } else all.push(sequenceLength - 1);

      const positions = int64(all, [1, first ? sequenceLength : 1]);

      let output: TensorMap;

      try { output = await runGraph(engine, 'language_model', { inputs_embeds: embeds, attention_mask: mask, position_ids: positions, ...cache }); }

      finally { embeds.dispose(); mask.dispose(); positions.dispose(); }

      const logits = Object.values(output)[0];

      const raw = await logits.getData();

      const float = logits.type === 'float16' ? Float32Array.from(raw as Uint16Array, halfToFloat) : new Float32Array(raw as Float32Array);

      const token = chooseSpeechToken(float, generated, previewSampling);

      logits.dispose(); disposeTensors(cache); cache = {};

      let index = 1;

      for (const name of engine.sessions.language_model.inputNames) if (/^past_key_values\./.test(name)) cache[name] = Object.values(output)[index++];

      if (token === SAMPLING.stopToken) { reachedEos = true; break; }

      generated.push(token); input = int64([token], [1, 1]); first = false;

    }

    const speech = generated.slice(1);

    if (!reachedEos || !speech.length) throw new Error('Incomplete speech generation; no partial audio accepted.');

    all = [...Array.from(reference.audio_tokens.data as BigInt64Array, Number), ...speech, SAMPLING.silenceToken, SAMPLING.silenceToken, SAMPLING.silenceToken];

    const speechTokens = int64(all, [1, all.length]);

    try {

      const decoded = await runGraph(engine, 'conditional_decoder', { speech_tokens: speechTokens, speaker_embeddings: reference.speaker_embeddings, speaker_features: reference.speaker_features });

      try {

        const waveform = Object.values(decoded)[0];

        const raw = await waveform.getData();

        const samples = waveform.type === 'float16' ? Float32Array.from(raw as Uint16Array, halfToFloat) : new Float32Array(raw as Float32Array);

        if (!samples.length) throw new Error('Local voice generated no samples.');

        for (let index = 0; index < samples.length; index++) if (!Number.isFinite(samples[index])) throw new Error('Local voice generated invalid samples.');

        return samples;

      } finally { disposeTensors(decoded); }

    } finally { speechTokens.dispose(); }

  } finally { input.dispose(); disposeTensors(cache); }

}

async function handleRequest(data: WorkerRequest): Promise<void> {

  if (cancelled.delete(data.id)) { settledId = data.id; self.postMessage({ id: data.id, kind: 'cancelled' }); return; }

  runtimeFailure = false;

  let inputRejected = false;

  requestContext = { id: data.id, runId: Date.now().toString(36) + '-' + data.id, started: performance.now(), workload: data.kind === 'preload' || data.kind === 'preview-config' ? 'preload' : data.text.length <= 100 ? '1-100' : data.text.length <= 300 ? '101-300' : '301-1000' };

  graphs.clear();

  status('preparing', 'Preparing Chatterbox Nano', { startedAt: Date.now(), confirmedAt: Date.now() });

  const heartbeat = setInterval(() => self.postMessage({ heartbeat: Date.now() }), 1000);

  measure({ operation: 'request', state: 'start' });

  try {

    if (!(data.voice in VOICE_REFERENCES)) { inputRejected = true; throw new Error('Unsupported reference voice.'); }

    const ready = await loadEngine(data.forceWasm);

    if(data.kind==='preview-config') {

      inputRejected=true;

      const t=data.tuning;

      if(!t||!Number.isFinite(t.temperature)||t.temperature<.2||t.temperature>1.5||!Number.isInteger(t.topK)||t.topK<1||t.topK>6563||!Number.isFinite(t.topP)||t.topP<.05||t.topP>1||!Number.isFinite(t.repetitionPenalty)||t.repetitionPenalty<1||t.repetitionPenalty>2)throw Error('Invalid sampling controls');

      if(data.samples!==null && (!(data.samples instanceof Float32Array)||data.samples.length<24000||data.samples.length>LIMITS.referenceSamples||!data.samples.every(Number.isFinite)))throw Error('Reference must be finite24k mono PCM of1–10seconds');
      inputRejected=false;

      if(cancelled.has(data.id))throw new DOMException('Speech interrupted.','AbortError');

      if(references.has(data.voice)){disposeTensors(references.get(data.voice)!);references.delete(data.voice);}

      if(data.samples)previewSamples.set(data.voice,data.samples.slice());else previewSamples.delete(data.voice);

      previewSampling={...t};clips.clear();clipBytes=0;

      await prepareReference(ready,data.voice);status('ready','Private reference configured · '+ready.backend);

      self.postMessage({id:data.id,kind:'preview-configured'});return;

    }

    const reference = await prepareReference(ready, data.voice);

    if (cancelled.has(data.id)) throw new DOMException('Speech interrupted.', 'AbortError');

    if (data.kind === 'preload') {

      status('ready', 'Chatterbox Nano ready · ' + ready.backend);

      self.postMessage({ id: data.id, kind: 'preloaded' });

    } else if (data.kind === 'plan') {

      inputRejected = true;

      const units: SpeechUnit[] = planSpeechUnits(data.text, value => Number(ready.tokenizer(value, { truncation: false, padding: false }).input_ids.dims.at(-1)), LIMITS.textTokens);

      status('ready', 'Chatterbox Nano ready · ' + ready.backend);

      self.postMessage({ id: data.id, kind: 'planned', units });

    } else {

      if (Number(ready.tokenizer(data.text, { truncation: false, padding: false }).input_ids.dims.at(-1)) > LIMITS.textTokens) { inputRejected = true; throw new Error('A whole speech unit exceeds model capacity.'); }

      const key = JSON.stringify([data.voice, data.text]);

      const started = performance.now();

      const clipReuse = clips.has(key);

      let samples = clips.get(key);

      if (!samples) {

        samples = await generateUnit(ready, data.text, reference);

        while (clipBytes + samples.byteLength > LIMITS.clipBytes && clips.size) { const oldest = clips.keys().next().value!; clipBytes -= clips.get(oldest)!.byteLength; clips.delete(oldest); }

        if (samples.byteLength <= LIMITS.clipBytes) { clips.set(key, samples); clipBytes += samples.byteLength; }

      }

      const copy = samples.slice();

      const speed = Number.isFinite(data.speed) ? Math.max(0.8, Math.min(1.4, data.speed)) : 1;

      status('ready', 'Chatterbox Nano ready · ' + ready.backend);

      self.postMessage({ id: data.id, kind: 'spoken', audio: { samples: copy, sampleRate: 24000 * speed, generationMs: performance.now() - started, backend: ready.backend, clipReuse } }, { transfer: [copy.buffer] });

    }

    measure({ operation: 'request', state: 'complete', durationMs: performance.now() - requestContext.started });

  } catch (error) {

    if (error instanceof DOMException && error.name === 'AbortError') {

      status('ready', 'Speech interrupted · voice remains loaded');

      measure({ operation: 'request', state: 'error', durationMs: performance.now() - requestContext.started });

      self.postMessage({ id: data.id, kind: 'cancelled' });

      return;

    }

    status('error', (error instanceof Error ? error.message : String(error)) + ' · last operation: ' + current.message);

    measure({ operation: 'request', state: 'error', durationMs: performance.now() - requestContext.started });

    self.postMessage({ id: data.id, kind: 'failed', message: current.message, runtimeFailed: runtimeFailure, inputRejected, backend: current.graphs?.[0]?.backend || 'wasm' });

  } finally { clearInterval(heartbeat); cancelled.delete(data.id); settledId = data.id; }

}

function handleMessage(event: MessageEvent<WorkerCommand>): void {

  const data = event.data;

  if (data.kind === 'cancel') { for (const id of data.ids) if (id > settledId) cancelled.add(id); return; }

  queue = queue.then(() => handleRequest(data));

}

self.onmessage = handleMessage;
