# Portable voice package v1

The container is a standard ZIP using stored entries, UTF-8 paths and CRC32. Media
is standard mono PCM16 RIFF/WAVE at 24 kHz. The JSON manifest has schema
`vociferous.voice-package/v1`; it is a product schema, not a claim of an external
industry-wide voice-preset standard. SHA-256 provides content integrity, not a
cryptographic author signature.

Every package contains:

- `manifest.json`: unique export UUID/time, purpose and creator identity.
- `README.txt`: portable interpretation and privacy boundary.
- `conditioning-reference.wav` for working packages, or
  `finalized-reference.wav` for production packages.

Private working packages additionally contain `project.json` and `samples/<uuid>`
with the original imported media bytes. The project document is
`vociferous.project/v1`, carrying immutable edit records, a selected order, disabled
edit IDs and pinned A/B projections. Sample metadata records original media type,
name, SHA-256, duration, excerpt selection and gain. No absolute source paths are
needed. Preserve these packages privately; their source material is not a public
production asset.

Production-reference packages omit source media and edit history. They retain the
chosen generated reference, settings, model provenance, creator identity and
consumer contract. `conditioning.generated=true` identifies generated calibration
audio. The Natally consumer adapter accepts only this purpose and its existing
exact checkpoint, and verifies the reference hash and canonical WAV bounds.

Creator fields are `appId`, `name`, `url`, `version` and `commit`:
`mba.robin.vociferous-cloner-studio`, Vociferous Cloner Studio,
https://github.com/rebots-online/vociferous-cloner-studio . An uncommitted source
tree is marked `+dirty`; do not mistake its commit for a clean release. The creator
is separate from the target consumer (`mba.robin.natally`,
https://natally.robin.mba) and from the engine/model owner.

Engine fields include `adapter`, `model`, exact `revision`, `sourceUrl`,
`revisionUrl`, `license`, `upstream`, exact runtime versions, reference limits and
`files`. Each file records its relative path, authoritative revision-pinned direct
download URL, size and SHA-256. Consumers can retrieve the exact assets and verify
them without model-name search. `weightsIncluded=false` explicitly prevents the
metadata from being interpreted as bundled checkpoint weights.

The first adapter identifies `owensong/chatterbox-nano-ONNX` at checkpoint
`4a66d7dab72a9e98f24b515d49a1d7a81632df2e`, including all four graph/external-data
pairs and tokenizer/config files. Its source is
https://huggingface.co/owensong/chatterbox-nano-ONNX . License and notice links point
to that exact revision, and upstream Resemble AI links retain model provenance.

Processing, sampling and playback settings remain distinct. The manifest records
the exact settings used for the generated audition. Natally's consumer metadata
states `runtimeSampling=consumer-defaults` and
`processingBakedIntoReference=true`; it must not be interpreted as installing new
production sampling weights/parameters. A new consumer can choose a different
explicit policy while retaining the original provenance.

Import accepts the workbench's stored ZIP, verifies every declared file's size and
SHA-256, and rejects a different model/checkpoint for this adapter. It does not
execute scripts or follow arbitrary model URLs from an untrusted imported file.
Other engine implementations can consume the common descriptor and WAV media via
their own explicit adapter.
