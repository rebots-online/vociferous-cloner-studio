import type * as ort from 'onnxruntime-web/webgpu';
import type { AutoTokenizer } from '@huggingface/transformers';
import type { VoiceMeasurement } from './voiceMeasurements';

export interface GenerationTuning { temperature:number; topK:number; topP:number; repetitionPenalty:number }
export type VoiceId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'M1' | 'M2';
export type Backend = 'webgpu' | 'wasm';
export type GraphRole = 'embed_tokens' | 'speech_encoder' | 'language_model' | 'conditional_decoder';
export interface LocalSpeech { samples: Float32Array; sampleRate: number; generationMs: number; backend: Backend; clipReuse: boolean }
export interface SpeechSegment { text: string; start: number; end: number }
export interface SpeechUnit extends SpeechSegment { tokenCount: number }
export type BackchannelStage = 'receipt' | 'interrupt' | 'answer' | 'continuation';
export interface SpeechCallbacks { onStart?: () => void; onEnd?: () => void; onPlaybackState?: (playing: boolean) => void; onWordBoundary?: (charIndex: number, charLength?: number) => void }
export interface SpeechProgress {
  phase: 'idle' | 'thinking' | 'preparing' | 'speaking' | 'complete' | 'interrupted' | 'error';
  message: string; turnId: number; totalUnits: number; readyUnits: number; playedUnits: number;
  startedAt: number; confirmedAt: number; maxGapMs: number; final: boolean;
  playingUnit: number | null; generatingUnit: number | null;
  cueStage: BackchannelStage | null; gapCueCount: number; gapCueStartedAt?: number; gapCueEndedAt?: number;
  maxUncoveredGapMs: number; lastAnswerStartedAt?: number;
  submittedAt?: number; ackStartedAt?: number; ackEndedAt?: number; bridgeStartedAt?: number; bridgeEndedAt?: number;
  firstTextAt?: number; firstAudioAt?: number; lastAudioEndAt?: number;
}
export interface SpeechTurn {
  id: number; acknowledged: Promise<void>; update: (text: string, final?: boolean) => void;
  done: () => Promise<boolean>; fail: (error: unknown) => void; cancel: () => void;
}
export interface VoiceFileProgress { file: string; loadedBytes: number; totalBytes: number; source: 'cache' | 'network' | 'unknown' }
export interface VoiceGraphProgress { file: string; backend: Backend; operation: 'session' | 'run'; state: 'start' | 'complete' | 'error'; completed: number; expected?: number; startedAt: number; durationMs?: number }
export interface VoiceStatus {
  phase: 'idle' | 'loading' | 'preparing' | 'ready' | 'synthesizing' | 'error'; message: string;
  loadedBytes?: number; totalBytes?: number; file?: string; files?: VoiceFileProgress[]; graphs?: VoiceGraphProgress[];
  startedAt?: number; confirmedAt?: number; runtimeEvent?: boolean; heartbeatAt?: number;
}
export type WorkerRequest =
  | { id:number; kind:'preview-config'; voice:VoiceId; forceWasm:boolean; samples:Float32Array|null; tuning:GenerationTuning }
  | { id: number; kind: 'preload'; voice: VoiceId; forceWasm: boolean }
  | { id: number; kind: 'plan'; voice: VoiceId; forceWasm: boolean; text: string }
  | { id: number; kind: 'speak'; voice: VoiceId; forceWasm: boolean; text: string; speed: number; priority?: 'foreground' | 'idle' };
export type WorkerCommand = WorkerRequest | { kind: 'cancel'; ids: number[] };
export type WorkerPayload = Omit<Extract<WorkerRequest, { kind: 'preview-config' }>, 'id'> | Omit<Extract<WorkerRequest, { kind: 'preload' }>, 'id'> | Omit<Extract<WorkerRequest, { kind: 'plan' }>, 'id'> | Omit<Extract<WorkerRequest, { kind: 'speak' }>, 'id'>;
export type WorkerMessage =
  | { status: VoiceStatus } | { heartbeat: number } | { measurement: VoiceMeasurement }
  | { id:number; kind:'preview-configured' }
  | { id: number; kind: 'preloaded' }
  | { id: number; kind: 'planned'; units: SpeechUnit[] }
  | { id: number; kind: 'spoken'; audio: LocalSpeech }
  | { id: number; kind: 'cancelled' }
  | { id: number; kind: 'failed'; message: string; runtimeFailed: boolean; inputRejected: boolean; backend: Backend };
export interface PendingRequest { kind: WorkerRequest['kind']; priority: 'foreground' | 'idle'; resolve: (value: WorkerMessage) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
export type Sessions = Record<GraphRole, ort.InferenceSession>;
export type TensorMap = Record<string, ort.Tensor>;
export type Tokenizer = Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
export interface Engine { sessions: Sessions; tokenizer: Tokenizer; backend: Backend }
export interface ModelFile { bytes: number; sha256: string }
export interface ReferenceSpec { path: string; bytes: number; gitBlob: string }
export type WebGpuNavigator = Navigator & { gpu?: { requestAdapter(options?: { powerPreference: 'high-performance' }): Promise<WebGpuAdapter | null> } };
export interface WebGpuAdapter { features: { has(value: string): boolean } }
