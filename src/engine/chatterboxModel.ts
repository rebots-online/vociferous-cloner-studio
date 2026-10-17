export const CHATTERBOX_MODEL = 'owensong/chatterbox-nano-ONNX';
export const CHATTERBOX_REVISION = '4a66d7dab72a9e98f24b515d49a1d7a81632df2e';
export const CHATTERBOX_FILES = {
  "tokenizer_config.json": {
    "bytes": 414,
    "sha256": "0d637373c70a54c3c7202c0c12b40ff4f346c329960283f5a88031717d73c66f"
  },
  "generation_config.json": {
    "bytes": 55,
    "sha256": "91d2e5ff0fd172d5e8ac4818ef8bcd9b9ee4f7e562831edc8cc3b3702e64f923"
  },
  "config.json": {
    "bytes": 1206,
    "sha256": "31de0e848899a63d26fdaacc4287bd14963d8f028a8af8583767b3f678f3c576"
  },
  "onnx/speech_encoder_q4f16.onnx_data": {
    "bytes": 176273652,
    "sha256": "55d89bd87fd36be48b2e831c99c2e309d432169119049066f9f22fcfe517798d"
  },
  "preprocessor_config.json": {
    "bytes": 130,
    "sha256": "1c320b2eea5f45678d17d891d51c38467775091dbf26a074635ba5e98ede5950"
  },
  "onnx/embed_tokens_fp16.onnx": {
    "bytes": 1520,
    "sha256": "019d257243774091d78c2ad91c2c0f61e4e442740cb7b3b00b5a89109417b18d"
  },
  "onnx/language_model_q4f16.onnx": {
    "bytes": 522078,
    "sha256": "8fe9620856d86b8a0235041d7fd2a8a47292da50828044bab5740b246e66e65b"
  },
  "onnx/conditional_decoder_q4.onnx": {
    "bytes": 2179022,
    "sha256": "745faa9c2e2494a81e47f2a72601ac248639fd417ae53d999c5068bc441d1f97"
  },
  "tokenizer.json": {
    "bytes": 3562272,
    "sha256": "3f04e34bea22f9144d1a19151154095bc9ce0430bf421304f5797e716288a906"
  },
  "onnx/embed_tokens_fp16.onnx_data": {
    "bytes": 87304704,
    "sha256": "bcd7b35ae4f206932e2491cb60b42ebb80f6d8facfdb53ba7d7449ad00a3237b"
  },
  "onnx/conditional_decoder_q4.onnx_data": {
    "bytes": 246397384,
    "sha256": "b5c5317e0b79a1a19dd3d5e2b2091ea06b15716716ab801a54eaeb906c6971ec"
  },
  "onnx/speech_encoder_q4f16.onnx": {
    "bytes": 1219352,
    "sha256": "29e249f59eaf95015527588b955e5286c7ee4524e7bb54a2f8d589b838e8aed2"
  },
  "onnx/language_model_q4f16.onnx_data": {
    "bytes": 55911658,
    "sha256": "8f2fdc616373c9ccaebbf2db3210dc80c860922a672898bca111eb75f6d3abd2"
  }
} as const;

export const GRAPH_PATHS = { embed_tokens: 'onnx/embed_tokens_fp16.onnx', speech_encoder: 'onnx/speech_encoder_q4f16.onnx', language_model: 'onnx/language_model_q4f16.onnx', conditional_decoder: 'onnx/conditional_decoder_q4.onnx' } as const;
export const VOICE_REFERENCES = {
  F1: { path: 'voices/chatterbox/F1.wav', bytes: 826746, gitBlob: '00c070e9f5a32517553855f6ee5c637080bc949b' },
  F2: { path: 'voices/chatterbox/F2.wav', bytes: 742856, gitBlob: 'b3b22f19f7c371da815dd1017b122e9f41334691' },
  F3: { path: 'voices/chatterbox/F3.wav', bytes: 827740, gitBlob: '9318529ee38e611dab4da10dbc583d1b4bce8191' },
  F4: { path: 'voices/chatterbox/F4.wav', bytes: 738572, gitBlob: 'f0511673a2b3441f1ddd8baaf2afaf7b693dab9e' },
  F5: { path: 'voices/chatterbox/F5.wav', bytes: 866026, gitBlob: 'c3c1d44da99032d8b940abd062fdff880473a34c' },
  M1: { path: 'voices/chatterbox/M1.wav', bytes: 860364, gitBlob: '2423bd687c6fd0ad12adda77955028af64b6fb55' },
  M2: { path: 'voices/chatterbox/M2.wav', bytes: 790152, gitBlob: '96be260e1eb51f003238d503bd0da51d42a22ee1' },
} as const;
export const LIMITS = { textTokens: 768, speechTokens: 4096, contextTokens: 8196, clipBytes: 16000000, referenceSamples: 240000, sampleRate: 24000, inactivityMs: 300000 } as const;
export const SAMPLING = { temperature: 0.8, topK: 1000, topP: 0.95, repetitionPenalty: 1.2, startToken: 6561, stopToken: 6562, silenceToken: 4299 } as const;
export const BACKCHANNEL_POOL_VERSION = 1;
export const BACKCHANNEL_TARGET = 2;
export const BACKCHANNEL_PALETTES = {
  receipt: ['Hmm.', 'Let me take a look.', 'Let me check your chart.', 'One moment.'],
  interrupt: ['Mm.', 'Hmm.', 'Mm-hm.', 'Ah.'],
  answer: ['All right.', "Okay. Let's start here.", "Here's what stands out.", "Let's take this a little at a time."],
  continuation: ['Mm.', 'Let me stay with that thought.', 'Hmm.', 'Let me linger on that a moment.'],
} as const;
