export const VOICE_REVISION = '4a66d7dab72a9e98f24b515d49a1d7a81632df2e';
export interface VoiceMeasurement {
  operation: 'request' | 'load' | 'file' | 'session' | 'run';
  state: 'start' | 'complete' | 'error';
  runId: string;
  atMs?: number;
  durationMs?: number;
  file?: string;
  backend?: string;
  source?: 'cache' | 'network' | 'unknown';
  workload?: string;
  revision: string;
  memoryReuse?: boolean;
  clipReuse?: boolean;
  speed?: number;
  steps?: number;
  capturedStart?: boolean;
  bytes?: number;
}
export const SURVEY_OPTIONS = {
  device: ['unknown', 'phone', 'tablet', 'laptop', 'desktop'],
  os: ['unknown', 'android', 'ios', 'windows', 'macos', 'linux'],
  browser: ['unknown', 'chrome', 'edge', 'firefox', 'safari', 'other'],
  memory: ['unknown', 'up-to-4GB', '6-8GB', '12-16GB', 'over-16GB'],
  power: ['unknown', 'normal', 'battery-saver', 'plugged-in'],
  network: ['unknown', 'wifi', 'mobile', 'ethernet', 'offline'],
  experience: ['unknown', 'works', 'repeated-loading', 'load-failure', 'synthesis-failure'],
} as const;
export type VoiceSurvey = { [K in keyof typeof SURVEY_OPTIONS]: string };
export const EMPTY_SURVEY: VoiceSurvey = Object.fromEntries(Object.keys(SURVEY_OPTIONS).map(key => [key, 'unknown'])) as VoiceSurvey;

export function summarizeMeasurements(events: readonly VoiceMeasurement[]) {
  const groups = new Map<string, { context: Omit<VoiceMeasurement, 'runId' | 'atMs' | 'state' | 'durationMs' | 'bytes'>; values: number[] }>();
  for (const event of events) {
    if (event.state !== 'complete' || event.capturedStart === false || !Number.isFinite(event.durationMs)) continue;
    const context = { operation: event.operation, file: event.file, backend: event.backend, source: event.source,
      workload: event.workload, revision: event.revision, memoryReuse: event.memoryReuse, clipReuse: event.clipReuse, speed: event.speed, steps: event.steps };
    const key = JSON.stringify(context);
    const group = groups.get(key) ?? { context, values: [] as number[] };
    group.values.push(event.durationMs!);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ context, values }) => {
    const count = values.length;
    const meanMs = values.reduce((sum, value) => sum + value, 0) / count;
    const sampleStdDevMs = count > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - meanMs) ** 2, 0) / (count - 1)) : null;
    return { ...context, count, meanMs, minMs: Math.min(...values), maxMs: Math.max(...values), sampleStdDevMs,
      observedTwoSigmaMs: sampleStdDevMs === null ? null : 2 * sampleStdDevMs,
      observedThreeSigmaMs: sampleStdDevMs === null ? null : 3 * sampleStdDevMs };
  });
}

export class VoiceMeasurementStore {
  private enabled = false;
  private events: VoiceMeasurement[] = [];
  private omittedEvents = 0;
  private reportId = '';
  private snapshotSequence = 0;
  private readonly starts = new Set<string>();
  constructor(private readonly limit = 10000) {}
  setEnabled(value: boolean) { this.enabled = value; this.starts.clear(); }
  record(event: VoiceMeasurement) {
    if (!this.enabled) return;
    if (this.events.length >= this.limit) { this.omittedEvents++; return; }
    // Explicit whitelist: runtime error messages, speech, accounts and URLs never enter exports.
    const clean: VoiceMeasurement = { operation: event.operation, state: event.state, runId: event.runId, atMs: event.atMs, revision: event.revision };
    const key = JSON.stringify([event.runId, event.operation, event.file, ['request', 'load'].includes(event.operation) ? undefined : event.backend]);
    if (event.state === 'start') this.starts.add(key);
    else { clean.capturedStart = this.starts.delete(key); }
    for (const key of ['durationMs', 'bytes', 'speed', 'steps'] as const) if (Number.isFinite(event[key]) && event[key]! >= 0) clean[key] = event[key];
    if (event.file && /^(?:onnx\/)?(?:embed_tokens_fp16|speech_encoder_q4f16|language_model_q4f16|conditional_decoder_q4)\.onnx(?:_data)?$|^(?:config|tokenizer|tokenizer_config|generation_config|preprocessor_config)\.json$|^voices\/chatterbox\/[FM][1-5]\.wav$/.test(event.file)) clean.file = event.file;
    if (['wasm', 'webgpu'].includes(event.backend || '')) clean.backend = event.backend;
    if (['cache', 'network', 'unknown'].includes(event.source || '')) clean.source = event.source;
    if (['preload', '1-100', '101-300', '301-1000'].includes(event.workload || '')) clean.workload = event.workload;
    if (typeof event.memoryReuse === 'boolean') clean.memoryReuse = event.memoryReuse;
    if (typeof event.clipReuse === 'boolean') clean.clipReuse = event.clipReuse;
    this.events.push(clean);
  }
  snapshot() { return { enabled: this.enabled, events: this.events.map(event => ({ ...event })), omittedEvents: this.omittedEvents }; }
  clear() { this.events = []; this.omittedEvents = 0; this.reportId = ''; this.snapshotSequence = 0; this.starts.clear(); }
  export(survey: VoiceSurvey) {
    const cleanSurvey = { ...EMPTY_SURVEY };
    for (const key of Object.keys(SURVEY_OPTIONS) as (keyof VoiceSurvey)[]) {
      if ((SURVEY_OPTIONS[key] as readonly string[]).includes(survey[key])) cleanSurvey[key] = survey[key];
    }
    this.reportId ||= crypto.randomUUID();
    const snapshot = this.snapshot();
    return { schema: 'natally-voice-measurements/v1', reportId: this.reportId, snapshotSequence: ++this.snapshotSequence, runtime: '@huggingface/transformers@4.3.1 + onnxruntime-web@1.31.0-dev.20260914-8d85527a0',
      scope: 'voluntary session sample; observed spreads are not population confidence intervals',
      survey: cleanSurvey, events: snapshot.events, omittedEvents: snapshot.omittedEvents, summary: summarizeMeasurements(snapshot.events) };
  }
}

export const voiceMeasurements = new VoiceMeasurementStore();
