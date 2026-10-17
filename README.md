# Vociferous Cloner Studio

A private, local Web UI for ingesting voice recordings, building a reference,
auditioning Chatterbox voices, comparing revisions and exporting a reusable voice.
It is separate from Natally and can serve other YouTube Creator Tools projects.

The product direction is a standalone application with CLI and Web UI, using the
organizational Tauri 2 default for Windows, Linux, Web and Android. Model/preset
selection, additional cloning adapters, native packaging and the new iteration
format are specified work, not capabilities of the current release. Qt6 remains
an optional client behind the shared core contracts. See
[architecture](DOCS/ARCHITECTURE.md) and the forward
[file-format standard](DOCS/FILEFORMAT.md).

Vociferous is a separate spinoff inspired by Natally, intended to earn its keep
as an independent tool for YouTubers and other content creators. Web consumption
is one output use. Rendered audio, reusable voice/reference packages and private
working iterations serve native/mobile apps, CLI pipelines and creator tools too;
Natally is an optional consumer integration.

Run on native Windows with Node and npm:

```powershell
cd C:\Users\Admin\Desktop\DevProjects\vociferous-cloner-studio
npm ci
npm run dev
```

Open the private URL stored in
`$env:LOCALAPPDATA\VociferousClonerStudio\session.json`. It includes a session
fragment required by the local API. The server binds only to `127.0.0.1:5177`,
rejects foreign origins/hosts and requires the session token for reading or
editing private data. A server restart creates a new session. Do not publish
that session file or URL. No public editing endpoint is deployed.

To enable staging into Natally's existing checkout:

```powershell
npm run dev -- --natally-repo E:\devProjects\natally-chatterbox
```

The default project data directory is
`$env:LOCALAPPDATA\VociferousClonerStudio`. Samples, private project histories,
session data and rollback copies stay there, outside either Git repository and
the build's public directory. Model weights are cached by the browser; they are
not committed or bundled in voice exports. The first explicit model initialization
or generated preview may download the pinned model files, with byte progress.

Use the workbench in this order:

1. Add local recordings, or use the clearly labelled stock reference to explore.
2. Enable excerpts, set their start/length/gain and order them. The conditioning
   budget is **1–10 seconds total**. Excess input is rejected rather than discarded.
3. Use reference cleanup, EQ, actual sampling controls and playback controls.
   Build/listen to the exact reference, then generate an audition.
4. Pin revisions A/B. The edit ledger supports any enabled subset, reordering,
   undo-last-N and later re-enabling. An edit whose sample addition was excluded
   is flagged; resolve it before generation. Save privately to retain the project.
5. Export a **private working ZIP** to retain source recordings, complete history
   and pins. Import restores those materials with content-hash verification.
6. Generate/listen to a short calibration phrase of 1–10 seconds. Export a
   **production-reference ZIP**, which contains generated audio and safe provenance,
   without the private source library or history.
7. If enabled, **Stage finalized voice for Natally** writes only that generated
   reference into F4, updates its exact byte/cache identity, and adds safe preset
   metadata. It saves a private rollback copy. It does **not** commit, push, build
   or deploy Natally. Review those consumer changes, then run Natally's usual
   build/publication/production verification process.

This engine performs zero-shot reference conditioning, not weight training. Adding
samples changes the selected composite reference. It does not accumulate every
recording into model weights, average speaker embeddings, or pretend that a larger
sample library bypasses the checkpoint's reference limit.

The available generation controls are temperature, top K, top P and repetition
penalty. This ONNX export has no wired CFG/exaggeration control. Playback rate and
pitch both use resampling and therefore affect tempo/pitch together. Generation
controls affect the audition; a generated production reference carries its vocal
result while Natally retains its declared production sampling defaults. The export
records that distinction.

The format is a standard stored ZIP containing WAV and JSON, with a versioned
manifest. It records the creator app's stable ID, source URL, version/commit,
export UUID/time, exact model/checkpoint and authoritative per-file download URLs,
hashes, license and upstream provenance. **Checkpoint weights are not included.**
See [export format](DOCS/EXPORT-FORMAT.md) and [architecture](DOCS/ARCHITECTURE.md).

The core types/history/audio/export modules have no Natally UI/auth/provider
dependency. The engine adapter is explicit. The optional Node consumer adapter
is the only module that knows Natally's reference-file layout. A different project
can consume the WAV/manifest or add its own adapter.

Validation commands are `npm run check`, `npm run build`, `node --check server.mjs`
and `node --check adapters/natally-promotion.mjs`. Runtime evidence and unfinished
operator voice/listening/consumer acceptance are kept in CHECKLIST.md.
