# Self-describing file formats — organizational standard and voice profile

Authority: Robin, 2026-10-17, Vociferous Cloner Studio conversation. Applies to
new proprietary file formats and incompatible format revisions across our apps.
The application default is Tauri 2 for Windows, Linux, Web and Android; file
semantics must remain independent of the shell, operating system and UI toolkit.
Vociferous is an independent creator tool inspired by Natally, with Natally as
one optional consumer. Web consumption is one output use, not a format assumption.

Status: normative design requirements. The current exporter still writes
`vociferous.voice-package/v1`, documented in EXPORT-FORMAT.md. It does not yet
implement the new envelope or the v2 profile specified here. Do not relabel v1
archives as v2. This document establishes the forward standard, not runtime proof.

## 1. Required outcome

A tool that understands this convention must be able to open a file, identify
what it is and what it is for, inspect its contents and exact requirements, and
determine how to consume it without searching externally. A filename extension,
model name, app name, link to an unspecified latest release or remote schema alone
does not meet that requirement. URLs provide direct locations, not missing meaning.

Distinguish three properties in metadata and UI:

- Self-describing: identity, semantics, schema and consumption contract are inside.
- Reproducible: every required input, dependency and setting has an exact identity;
  declared backend nondeterminism may prevent bit-identical synthesis.
- Self-contained: all resources needed for the declared operation are bundled.
  A package may be self-describing without bundling model weights. It must say so.

No format can promise that an external URL will stay reachable. A file must be
inspectable offline and must state exactly what prevents offline consumption.

## 2. Discovery and container

Formats may use standard containers with proprietary, versioned schemas. Do not
invent encryption, compression or audio encodings merely to make a format ours.
The voice profile uses a ZIP with UTF-8 relative paths and standard WAV/JSON data.
New voice files use `.vcsvoice`; identify them by contents, never extension alone.
The media type `application/vnd.robin.vociferous.voice+zip` is an internal identifier,
not a claim of IANA registration. ZIP local-header magic remains standard ZIP magic.

Every archive has these unambiguous root entries:

- `manifest.json`: UTF-8 JSON envelope and product profile, no duplicate JSON keys.
- `README.txt`: plain-language identity, purpose, entrypoints and missing resources.
- `schema/envelope.schema.json`: embedded JSON Schema for the envelope.
- `schema/profile.schema.json`: embedded JSON Schema for the product profile.
- `docs/CONSUMPTION.md`: embedded interpretation, dependency and API contract.
- Product payload paths, plus any bundled resources declared in the manifest.

Schemas use JSON Schema draft 2020-12. All `$ref` targets must resolve within the
package; validators never need remote schema retrieval. The manifest declares
`format.family = robin.self-describing-artifact`, `format.envelopeVersion = 1.0.0`
and `format.profile = vociferous.voice-package/v2` for this voice profile.
Unknown profile data remains inspectable; unsupported required capabilities
prevent consumption with a specific explanation rather than a best-effort guess.

Single-file nonarchive formats must embed equivalent metadata/schema/docs in a
documented discoverable header or metadata block. A neighboring sidecar alone is
insufficient: the file must carry the information when copied independently.

## 3. Common envelope — mandatory fields

All named fields below are required unless an explicit conditional rule applies.
Strings describing meaning must be substantive; placeholders are invalid.

| Field | Meaning and required contents |
| --- | --- |
| `format` | Family, envelope version, product profile, media type, embedded schema paths, specification title/version/URL and embedded specification path. |
| `artifact` | UUID, title, semantic description, intended uses, artifact kind, creation UTC timestamp, privacy classification and language where applicable. |
| `producer` | Stable app ID, app name, semantic description, canonical app/source URL, exact app version, source commit and dirty-tree flag, build ID and platform. |
| `consumer` | Supported operations, payload entrypoints, required capabilities, compatible adapter IDs/versions, embedded instructions path and consumer implementations. Each implementation has stable ID, name, description, purpose, URL and supported version range. |
| `dependencies` | Exhaustive dependency records, including transitive runtime assets needed for the declared operations; see section 4. Empty only when genuinely unnecessary. |
| `resources` | Every payload/schema/doc resource except the manifest itself: unique path, semantic role/description, media type, byte length and SHA-256 of exact uncompressed bytes. |
| `provenance` | Origin, transformations, source identities/hashes and attribution, preserving whether media is recorded, processed or generated. Source disclosure depends on export purpose. |
| `reproducibility` | Exact input/config references, randomness/seed state, backend/runtime and numerical precision, determinism limits, and required versus advisory settings. |
| `availability` | Per-operation offline readiness, missing dependency IDs and reason; explicit bundled/external status. Never infer readiness from a URL. |
| `rights` | Artifact licence/use terms, dependency licences/attribution, source recording permission/use declaration where applicable; unknown facts explicitly marked unknown. |
| `compatibility` | Minimum reader version, required feature IDs, migration source and optional namespaced extension declarations. |
| `profile` | Product-specific state and semantics, for voice defined below. |

The manifest is excluded from its own resource hash list to avoid recursive
hashing. Hash the entire archive separately in an export receipt. SHA-256 checks
integrity, not authorship. If signing is added, specify signature algorithm,
canonicalization, signed bytes and trust mechanism separately.

## 4. Dependency records and model identity

Every dependency record includes stable ID, kind, name, semantic description,
purpose, exact version/revision, canonical source URL, licence identifier/terms,
supported platform/backend constraints, required operations, `dependsOn` IDs,
configuration/loader contract, and whether it is bundled, cached or external.
`cached` is producer observation only; consumers must verify their own cache.

Each required dependency asset includes relative logical path, direct
revision-pinned retrieval URL, byte count, SHA-256, media/serialization type and
embedded path if bundled. Mutable branch names such as `main` are not exact
checkpoint identities. Auth/access requirements must be declared without secrets.
Acquisition follows explicit operator action and verifies bytes before use.

For models, additionally require:

- Model repository ID, model family, authoritative model-card URL at the exact
  revision, embedded model-card text and its provenance/hash.
- Exact checkpoint/revision, format, architecture, quantization/precision and all
  graphs, external tensor files, tokenizer, vocoder, config and other needed assets.
- Adapter ID/version, runtime packages/versions, input/output tensor or API
  contract and processing/tokenization requirements. Schemas/docs are embedded.
- Reference requirements: encoding, sample rate/channels, duration/count limits,
  language/transcript requirements and supported conditioning/training mode.
- Preset or speaker identity and semantics when supported, with exact preset
  resource hash; explicit `null` with a reason when not applicable.
- Supported controls and their types, units, bounds, defaults and application
  stage. Save resolved values, not just UI overrides or unspecified defaults.

Model-card text supports interpretation; exact assets and runtime contracts make
execution resolvable. A card URL alone is not sufficient. Never auto-execute
downloaded code, a pickle loader, shell command or package-supplied instructions.
An installed trusted adapter interprets the declarative contract.

## 5. Voice iteration profile

The product profile is `vociferous.voice-package/v2`. Each saved iteration is an
immutable snapshot with artifact UUID, project UUID, iteration UUID, parent
iteration UUIDs, label/semantic description and creation time. Parent identifiers
are lineage, not external restore dependencies: a working snapshot includes all
state/resources needed to resume that iteration even when parents are absent.

`profile.purpose` is `private-working` or `production-reference`:

- A private working snapshot includes source recordings, increment records,
  ordered edit history, selected/disabled edits, excerpt/gain/weight decisions,
  processing pipeline/order, resolved model/preset/controls, current reference,
  A/B pins and their required state/resources, and saved auditions if retained.
- A production reference includes the chosen output audio, its audio contract,
  effective generation/processing configuration, model/dependency metadata,
  iteration identity and safe lineage, and explicit consumer application rules.
  It excludes source recordings, transcripts, personal filenames and private
  edit history. Redacted provenance states that omission and its purpose.

Both purposes require a complete declared consumption contract. Production
packages support use of their output; they do not claim the private editing
session can be resumed. Readiness is declared separately for `inspect`,
`play-output`, `condition-tts`, `regenerate` and `resume-editing` as applicable.

Rendered narration/audio is a separate output use from a reusable cloning
reference or a private working snapshot. Declare intended use explicitly; never
treat arbitrary narration as an accepted conditioning reference. Native/mobile
apps, CLI/batch workflows, editing tools and Web apps may consume outputs.
No manifest may require Natally or a browser unless that particular output
actually depends on it. Generic packages declare compatible adapters/capabilities
and optional known consumers. A bare standard audio rendition may accompany the
archival package, but is not itself a complete conforming artifact unless its
own embedded metadata meets this standard; a neighboring JSON file is insufficient.

`profile.refinement` declares one actual mechanism:

- `reference-conditioning`: update/select/compose permitted reference audio; model
  weights stay unchanged. A growing library is not a growing conditioning window.
- `multi-reference-conditioning`: only when the selected adapter implements it;
  preserve combination/weighting semantics and any model-specific embeddings.
- `fine-tuning`: only when an implemented training adapter actually changes
  weights; preserve dataset manifest, training recipe, base checkpoint, resulting
  checkpoint/delta files, hashes, loading requirements and dependency chain.

Each increment records source hash, provenance, optional transcript/language,
selection and preprocessing, enabled state and contribution to the current
reference/dataset. Record excluded material and why. Exceeding model limits must
produce an explicit selection/rejection decision; never silently discard inputs.
Do not promise every added recording improves resemblance: audition and record
operator preference against a stable test phrase before accepting a revision.

`profile.controls` distinguishes reference preprocessing, model inference and
output playback/postprocessing. Preserve pipeline order, units, resolved values,
seed if supported (otherwise explicit unsupported state), text/language and any
cached intermediate identity. Declare which settings are baked into audio and
which a consumer must apply; avoid applying processing twice. References,
embeddings and trained deltas are not assumed interchangeable across models.

## 6. Reader and writer behavior

Writers validate against both embedded schemas, check dependency closure and
resource hashes, and write atomically through each platform's storage adapter.
Failed saves preserve the last valid package. New snapshots do not overwrite
older iterations implicitly. Export receipts identify the final archive hash.

Readers first discover the envelope, validate paths/JSON/schema/version and show
identity/purpose without loading a model. They reject traversal, absolute paths,
links, duplicate/case-colliding paths, undeclared payloads and malformed or
mismatched sizes/hashes. Enforce explicit entry-count, expanded-size and compression
limits before extraction. ZIP stored entries are the initial writer profile;
other compression methods require an advertised reader capability.

Resolve exact dependencies from verified local cache or operator-approved direct
locations. Never search by guessed model names, substitute another checkpoint,
silently migrate settings or fetch/execute content merely because the manifest
names a URL. Unsupported dependencies allow inspection but block affected actions.

Unknown optional extensions may be preserved as opaque validated data; unknown
required extensions block execution. Breaking semantics require a new profile
major version. Migration is explicit, preserves the source, records source hash
and conversion losses, and writes a new artifact UUID. No manufactured missing
provenance. Inspect-only legacy support does not imply full v2 compliance.

## 7. Adoption and acceptance

Implement the envelope writer/reader and schemas once behind the shared command
contract; CLI, Web UI, Tauri and any Qt client use the same semantics. Include
`inspect --json` and `validate` operations that do not initialize inference.

Acceptance requires actual files and observed results:

1. Inspect an unfamiliar package offline and explain identity, purpose, producer,
   exact model/checkpoint, supported consumer and all missing requirements.
2. Restore a private iteration on another supported platform without the original
   directory, parent packages or undisclosed defaults; compare state/resource hashes.
3. Consume a production reference using only its embedded contract and explicitly
   resolved dependencies, without repository/model search or the private project.
4. Resolve an empty-cache package from direct pinned URLs and verify all bytes;
   deny unavailable/gated/wrong-checkpoint resources with actionable reasons.
5. Compare CLI/Web/Tauri state and output contracts; exercise optional Qt likewise
   if implemented. Record model/backend nondeterminism separately from state parity.
6. Reject corrupt resources, ambiguous paths, unsafe archives, unknown required
   features and false offline-readiness declarations; preserve prior valid saves.
7. Demonstrate explicit v1 import/migration, distinguishing recovered data from
   unknown information and preserving the original artifact.

This standard applies prospectively to our formats. Existing files remain valid
under their original documented schemas; adoption requires an explicit reader,
writer, compatibility and migration change with its own verification evidence.
