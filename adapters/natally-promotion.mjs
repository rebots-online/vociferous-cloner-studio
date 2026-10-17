import {readFile,writeFile,mkdir,rename,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export async function stageNatally(wav,preset,target,rollbackRoot){
  if(!target)throw Error('Launch with --natally-repo to enable this consumer adapter.');
  const root=path.resolve(target);await readFile(path.join(root,'.git','HEAD')).catch(async()=>{await readFile(path.join(root,'.git'));});
  if(preset?.schema!=='vociferous.voice-package/v1'||preset.purpose!=='production-reference'||preset.conditioning?.generated!==true||preset.history)throw Error('Only a generated production-reference export can be staged.');
  if(preset.engine?.model!=='owensong/chatterbox-nano-ONNX'||preset.engine.revision!=='4a66d7dab72a9e98f24b515d49a1d7a81632df2e')throw Error('Natally adapter requires its existing exact checkpoint.');
  if(wav.length<48044||wav.length>480044||wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE'||wav.toString('ascii',12,16)!=='fmt '||wav.readUInt32LE(16)!==16||wav.readUInt16LE(20)!==1||wav.readUInt16LE(22)!==1||wav.readUInt32LE(24)!==24000||wav.readUInt16LE(34)!==16||wav.toString('ascii',36,40)!=='data'||wav.readUInt32LE(40)!==wav.length-44||wav.readUInt32LE(4)!==wav.length-8)throw Error('Generated reference must be1–10seconds canonical24k mono PCM16 WAV.');
  if(createHash('sha256').update(wav).digest('hex')!==preset.conditioning.sha256)throw Error('Reference content does not match its manifest.');
  const modelPath=path.join(root,'src/services/chatterboxModel.ts'),voicePath=path.join(root,'public/voices/chatterbox/F4.wav'),metadataPath=path.join(root,'public/voices/chatterbox/F4.preset.json');
  const model=await readFile(modelPath,'utf8'),oldVoice=await readFile(voicePath);const pattern=/F4: \{ path: 'voices\/chatterbox\/F4\.wav', bytes: \d+, gitBlob: '[a-f0-9]{40}' \}/g;
  if([...model.matchAll(pattern)].length!==1)throw Error('Natally reference schema changed; adapter review required.');
  const blob=createHash('sha1').update(Buffer.from(`blob ${wav.length}\0`)).update(wav).digest('hex');const next=model.replace(pattern,`F4: { path: 'voices/chatterbox/F4.wav', bytes: ${wav.length}, gitBlob: '${blob}' }`);
  const backup=path.join(rollbackRoot,randomUUID());await mkdir(backup,{recursive:true});await writeFile(path.join(backup,'F4.wav'),oldVoice);await writeFile(path.join(backup,'chatterboxModel.ts'),model);let oldMetadata=null;try{oldMetadata=await readFile(metadataPath);await writeFile(path.join(backup,'F4.preset.json'),oldMetadata);}catch(error){if(error.code!=='ENOENT')throw error;}
  const metadata={schema:preset.schema,exportId:preset.exportId,createdAt:preset.createdAt,creator:preset.creator,engine:preset.engine,conditioning:preset.conditioning,processing:preset.processing,generation:preset.generation,consumer:preset.consumer,referenceGitBlob:blob};
  if(await readFile(modelPath,'utf8')!==model)throw Error('Natally model manifest changed concurrently; no consumer file changed.');
  const tempId=randomUUID();let mutated=false;try{await writeFile(voicePath+'.'+tempId,wav);await writeFile(modelPath+'.'+tempId,next);if(await readFile(modelPath,'utf8')!==model)throw Error('Natally model manifest changed concurrently; stage again after review.');await rename(voicePath+'.'+tempId,voicePath);mutated=true;await rename(modelPath+'.'+tempId,modelPath);await writeFile(metadataPath,JSON.stringify(metadata,null,2)+'\n');}catch(error){if(mutated){await writeFile(voicePath,oldVoice);await writeFile(modelPath,model);if(oldMetadata)await writeFile(metadataPath,oldMetadata);}throw error;}
  return {staged:true,target:root,changed:['public/voices/chatterbox/F4.wav','public/voices/chatterbox/F4.preset.json','src/services/chatterboxModel.ts'],rollback:backup,publication:'Not committed, pushed or deployed. Review/build/deploy the consumer repository separately.'};
}
