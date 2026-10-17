# Vociferous Cloner Studio — architecture

## Current product direction — operator instruction, 2026-10-17

Build an independent voice refinement application with a CLI and Web UI. The
organizational default is **Tauri 2: Windows, Linux, Web and Android**. Design for
all four from the beginning. Windows executable/installer, Linux AppImage and
Android packages are delivery targets; their existence and runtime acceptance
require separate build/install/device evidence. Web is a browser frontend build,
not a Tauri native binary running inside a browser.

**Product identity: Vociferous.** Natally inspired the need; Vociferous is a
separate spinoff that must earn its keep independently, potentially within a
collection of tools for YouTubers and content creators. A user without Natally
must be able to build a reference library, refine/audition a voice, save/reopen
iterations and produce useful deliverables. Consumer projects do not own its
domain model, file schema, model choices or release lifecycle.

Operation surfaces and output consumers are independent axes. The Web UI is one
operation surface; Web consumption is one output destination. Required output
contracts cover rendered narration/audio (WAV initially, other codecs through
explicit exporters), reusable voice/reference packages, resumable private working
projects, and model-specific conditioning/trained artifacts only where supported.
Rendered audio for editing, video production or podcast workflows must be
exportable independently of a browser and without staging into Natally. A
format-compliant archival package carries the metadata with its audio; a bare WAV
delivery is a media rendition rather than a complete voice package unless
equivalent self-description is embedded in it.

Consumers may be native/mobile apps, headless/batch pipelines, creator editing
tools or Web apps. Each output declares what the consumer needs and what it can
do with it. Natally is an optional adapter among those consumers, never the
default identity in a general production package. The current v1 export code
hardcodes Natally consumer metadata; replacing that assumption is required work.

Users choose a cloning-capable TTS model, a model voice/speaker preset where
supported, then ingest successive reference increments and adjust the supported
controls. Save every iteration with its source/data selection, exact model,
resolved parameters, lineage and audition for reproducible comparison and reuse.
The goal is a richer reference library and better selected voice result. Reference
conditioning does not train model weights or guarantee monotonic improvement;
multi-reference conditioning and training require explicit implemented adapters.

The product's forward file standard is [FILEFORMAT.md](FILEFORMAT.md). It also
defines the organizational requirement for self-describing proprietary formats.
Existing v1 exports remain governed by EXPORT-FORMAT.md until migration is
implemented. The requirements below describe the target, not released features.

### Shared boundaries

- Application commands/events own model discovery/selection, preset selection,
  sample ingestion, reference composition, controls, jobs/cancel/progress,
  revisions, A/B comparison, save/load and package inspect/validate/import/export.
  UI code does not own persistent state transitions or filesystem policy.
- A pure state/format layer owns revisions, validation, dependency descriptors,
  semantic metadata and serialization. It must work without a DOM, browser
  AudioContext, Tauri runtime or Qt runtime. CLI inspection never starts a model.
- Model adapters declare cloning support, conditioning/training mechanism,
  model/preset identity, limits, parameter schema and platform/backend capability.
  The selector shows unavailable models with specific reasons. It never exposes
  a knob an adapter cannot apply. Changing model creates a revision and validates
  compatibility rather than reusing incompatible embeddings or silent defaults.
- Runtime adapters execute jobs through the same typed request/event contract.
  Browser WebGPU/WASM execution and native inference are separate implementations
  with explicit capabilities. The current browser worker cannot be presumed to
  run headlessly in a Rust CLI or a Qt Quick client.
- Platform adapters own storage, file import/export, microphone/audio playback,
  model acquisition/cache, permissions and lifecycle. Native Tauri uses scoped
  commands/capabilities; Web uses browser storage and user-selected files. Android
  uses platform document handles and lifecycle/permission rules, not Windows paths
  or a desktop subprocess assumption. No mandatory Node/Python desktop sidecar
  in the common core. A desktop-only runner remains an optional capability.
- CLI provides the same domain operations through a headless command host, with
  machine-readable state/errors and job progress. It uses a native runner where
  available; unsupported generation is reported explicitly. CLI support must not
  mean automating hidden Web UI clicks. Desktop CLI is not an Android CLI promise.
- Desktop/mobile shells host the shared responsive Web UI; the standalone Web
  target uses the same contracts through browser adapters. Keep the optional
  Natally promotion adapter separate; no consumer-specific package semantics.

### Qt6 option — tasks, not elapsed-time estimates

Tauri 2 remains the default. Preserve the possibility of a Qt6 client by keeping
the command/event and file contracts independent of both toolkits. Qt is an
alternative shell/client, not a requirement to embed Qt inside Tauri.

| Approach | Additional tasks |
| --- | --- |
| Preserve the option | Extract UI-independent commands/state, define runtime/platform ports, and make package read/write/inspection available through the shared contract. These are shared architecture tasks. |
| Qt wrapper for Web UI | Create Qt host, package/load frontend, bridge file/audio/model services, manage jobs and lifecycle, and verify each embedded browser backend. |
| Qt Quick/QML interface | Create separate screens/bindings, waveform/excerpt editing, model-driven controls, revision/A-B flows, touch/desktop interaction, and connect all actions to the shared command/event contract. |
| Either shipped Qt option | Select Qt modules/licence/dependency versions; configure CMake and Windows/Linux/Android packaging; verify installation, audio, real synthesis, save/reopen and package parity on each target. |

Qt Quick supplies QML UI controls; Qt WebView hosts web content with platform
backend differences, including a Qt WebEngine dependency on Linux. These require
their own integration and runtime evidence. Current official references:
https://doc.qt.io/qt-6/qtquickcontrols-index.html and
https://doc.qt.io/qt-6/qtwebview-index.html . Qt module/licence selection is a
packaging task, not implied by choosing our own proprietary file extension.

### Required implementation and verification work

1. Define the shared command/event, platform and model capability contracts and
   extract existing state/audio/package logic without changing current behavior.
2. Add a model registry, preset selection and schema-driven supported controls;
   implement each model adapter and verify its real reference behavior separately.
3. Implement the FILEFORMAT.md envelope/schemas and iteration snapshots, legacy
   migration and independent CLI inspect/validate/import/export workflows; add
   generic output contracts and remove mandatory Natally consumer metadata.
4. Add a headless job host and native model runner with explicit backend support;
   wire the same domain operations into the CLI and Web UI.
5. Add Tauri 2 native adapters/shell for Windows/Linux/Android and browser adapters
   for Web; verify file/audio/permissions/cache/lifecycle behavior per platform.
6. Build/package Windows executable/installer, Linux AppImage and Android package;
   exercise install/open/ingest/generate/cancel/save/reopen/export across targets.
7. Verify cross-platform package/state parity and real audible A/B resemblance and
   phrase completeness. Keep build, runtime, device and publication evidence separate.

Tauri technical references: https://v2.tauri.app/start/ ,
https://v2.tauri.app/concept/process-model/ and
https://v2.tauri.app/reference/config/ . No framework selection alone proves
that this model runs on every platform/GPU/WebView.

## Released implementation contract — baseline before this direction

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
