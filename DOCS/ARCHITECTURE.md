# Vociferous Cloner Studio — released implementation contract

Authority: Robin,17 October2026. Separate repository for the reusable local voice
sample ingester/tweaker Web UI, potentially in YouTube Creator Tools. Natally stays
in E:\devProjects\natally-chatterbox. No Natally move, public editor, provider,
weight retraining, model change, or automatic deployment is released here.

Local-only Node/Vite Web UI,127.0.0.1: bind strictly to loopback; reject foreign
Host/Origin and require an ephemeral same-origin token for mutations. Private
samples/projects live under LOCALAPPDATA/VociferousClonerStudio, outside Git,
public and dist. No source voice is sent to a provider. Model assets resolve
from their exact recorded authoritative URLs on explicit engine initialization.

## Closed inventory

- W01 package.json/package-lock.json/tsconfig.json/vite.config.ts/index.html,
  server.mjs: runnable standalone project with only the existing exact Vite,
  TypeScript, Transformers.js and ONNX Runtime versions; vanilla DOM UI. Server
  functions readBody,sendJSON,validId,handleAPI,start. Anonymous loopback session,
  ephemeral token, bounded requests, UUID filenames and safe serialized writes.
  GET bootstrap/project/sample; POST project/sample/export/stage. Internal closure
  locals/callbacks and HTTP helpers within these bodies are permitted.
- W02 src/types.ts: exported EngineDescriptor,GenerationKnobs,ProcessingKnobs,
  SampleEntry,Change,EditEvent,ProjectState,VoiceState,VoiceAdapter,ExportManifest.
  Knobs: trim/duration, per-sample gain, global gain, normalize/target peak, gate,
  high-pass, low/mid/high EQ, fade; synthesis temperature/topK/topP/repetition;
  playback rate/pitch/tone. Display conditioning vs synthesis vs playback clearly.
- W03 src/history.ts: defaults,applyChange,replay,appendEdit,undoLast. Immutable edit
  IDs with editable enabled/order projection; arbitrary subset and ordering of
  edits; invalid dependencies explicit, last-write-wins field edits; snapshots,
  undo-last-N, restore/export/import preserve full history and pinned A/B revisions.
- W04 src/audio.ts: decodeAudio,composeReference,processAudio,encodeWav,drawWaveform.
  Decode local media; build ordered selected excerpts with explicit weights and
  total10-second conditioning budget, resample24k mono, short fades. Reject excess
  duration instead of silently dropping samples. No claim of weight learning or
  multi-reference embedding fusion. Listen to original/processed reference.
- W05 src/export.ts: sha256,crc32,zipStore,createExport. Standards-based ZIP with
  WAV,JSON,README; versioned vociferous.voice-package/v1 manifest; creator stable
  appId/name/sourceURL/version/commit; unique exportID/time; exact model/checkpoint,
  authoritative HF/source URLs, per-file resolve URLs/size/hash/license/upstream
  provenance; processing/generation/playback knobs, revision and edit ordering.
  Model weights are NOT included. Private working export can include source library
  and edit history. Production export includes only generated finalized reference,
  safe model/creator provenance and consumer settings, never source/history/path.
- W06 src/adapters/chatterbox.ts: descriptor,configureReference,generate,cancel,
  subscribeStatus; implements VoiceAdapter. Reuse the same pinned four-graph Nano
  path in src/engine, copied from Natally ce6c2bf with attribution, not linked to
  Natally's UI/auth/inference. Reference override and sampling options are local
  editor capabilities; validate all bounds, invalidate conditioning/PCM caches on
  change, cancel correctly, reuse sessions. No runtime advertisement for missing
  CFG/exaggeration knobs. No extra facial/audio model.
- W07 src/engine/{chatterbox.worker.ts,chatterboxTts.ts,chatterboxTypes.ts,
  chatterboxModel.ts,chatterboxGeneration.ts,speechUnits.ts,voiceMeasurements.ts}:
  retain existing declarations/model hashes/runtime/limits/cancellation. Add
  GenerationTuning,preview-config request/confirmation,configurePreview export;
  worker private previewSamples/previewSampling state; prepareReference uses
  validated24k PCM override, otherwise built-in reference. chooseSpeechToken gets
  optional validated tuning, generateUnit passes it; clip cache clears on config.
  No fixed voice file/model identity changes in Natally.
- W08 scripts/onnx-progress-plugin.ts copied with attribution for existing runtime
  instrumentation. public/voices/chatterbox/{F1..F5,M1,M2}.wav and NOTICE retain
  the existing publicly distributed stock references, never imported private audio.
- W09 src/main.ts/src/style.css: accessible responsive Web UI, sample ingest/list,
  selected excerpt/order controls, waveform, all supported knobs with explanations,
  immutable edit ledger with enable/disable/reorder/undoN, save/load/import/export,
  A/B pinned revisions, original/processed/generated listening, explicit init,
  cancel, generated calibration reference <=10s and local stage-for-Natally action.
  DOM functions render,renderSamples,renderHistory,renderKnobs,record,preview,
  play,save,load,exportPackage,importPackage,stage; scoped DOM/listener helpers
  permitted. No arbitrary remote scripts, generated innerHTML from user strings,
  hidden network transmission, autoplay or preview-blocking graphics.
- W10 adapters/natally-promotion.mjs: stageNatally(referenceWav,preset,target).
  Target only from operator launch argument --natally-repo. Verify Git checkout,
  expected file/schema, generated24k mono PCM16 WAV <=10s and no source manifest.
  Create private rollback copy; atomically stage generated F4.wav,exact bytes/git
  blob cache identity in chatterboxModel.ts and safe F4.preset.json. Never publish
  raw source or mutate weights. Return changed paths; no automatic git/push/deploy.
  Natally's existing fixed reference path consumes this staged file after its
  normal reviewed build/deploy. Voice controls recorded separately; promotion
  reference bakes chosen playback processing, production runtime defaults remain
  clearly identified rather than silently changed.
- W11 README.md,NOTICE.md,DOCS/EXPORT-FORMAT.md,CHECKLIST.md: independent project,
  provenance/schema, extraction boundary, privacy and production promotion steps.
  .gitignore excludes private data/exports/models/indexes/node_modules/dist.
- W12 Validation: TypeScript,syntax/build,diff,independent source review; ordinary
  localhost Web UI exercises ingest,knobs,selective history,A/B,save/reload,export,
  real same-model generated preview and staging against a temporary copied target.
  Actual operator voice/source not provided; do not finalize or deploy a different
  Natally voice as a substitute. Commit/push/verify origin after each task.

Export creator ID: mba.robin.vociferous-cloner-studio. Canonical source URL:
https://github.com/rebots-online/vociferous-cloner-studio . Consumer identity is
separate (Natally https://natally.robin.mba). Model/checkpoint identity is separate
again. SHA256 proves content integrity, not a cryptographic author signature.
