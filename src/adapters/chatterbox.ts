import {CHATTERBOX_MODEL,CHATTERBOX_REVISION,CHATTERBOX_FILES} from '../engine/chatterboxModel';
import {configurePreview,chatterboxSpeak,cancelChatterbox,subscribeVoiceStatus} from '../engine/chatterboxTts';
import type {VoiceAdapter} from '../types';
export const descriptor:VoiceAdapter['descriptor']={adapter:'chatterbox-nano-onnx/v1',model:CHATTERBOX_MODEL,revision:CHATTERBOX_REVISION,sourceUrl:'https://huggingface.co/'+CHATTERBOX_MODEL,revisionUrl:`https://huggingface.co/${CHATTERBOX_MODEL}/tree/${CHATTERBOX_REVISION}`,license:{id:'MIT',url:`https://huggingface.co/${CHATTERBOX_MODEL}/blob/${CHATTERBOX_REVISION}/LICENSE`,noticeUrl:`https://huggingface.co/${CHATTERBOX_MODEL}/blob/${CHATTERBOX_REVISION}/NOTICE.md`},upstream:['https://huggingface.co/ResembleAI/chatterbox-nano','https://github.com/resemble-ai/chatterbox'],runtime:{'onnxruntime-web':'1.31.0-dev.20260914-8d85527a0','@huggingface/transformers':'4.3.1'},files:Object.entries(CHATTERBOX_FILES).map(([path,entry])=>({path,...entry,url:`https://huggingface.co/${CHATTERBOX_MODEL}/resolve/${CHATTERBOX_REVISION}/${path}`})),reference:{sampleRate:24000,channels:1,maxSeconds:10},weightsIncluded:false};
export const configureReference:VoiceAdapter['configureReference']=configurePreview;
export const generate:VoiceAdapter['generate']=text=>chatterboxSpeak(text,{voice:'F4',speed:1});
export const cancel:VoiceAdapter['cancel']=()=>cancelChatterbox();
export const subscribeStatus:VoiceAdapter['subscribeStatus']=subscribeVoiceStatus;
