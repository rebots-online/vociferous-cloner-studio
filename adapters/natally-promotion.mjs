import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';

export async function stageNatally(wav,preset,target,rollbackRoot){
  if(!target)throw Error('Launch with --natally-repo to enable this consumer adapter.');
  const root=path.resolve(target);
  const gitDir=path.resolve(root,execFileSync('git',['rev-parse','--git-dir'],{cwd:root,encoding:'utf8',windowsHide:true}).trim());
  if(preset?.schema!=='vociferous.voice-package/v1'||preset.purpose!=='production-reference'||preset.conditioning?.generated!==true||preset.history)throw Error('Only a generated production-reference export can be staged.');
  if(preset.engine?.model!=='owensong/chatterbox-nano-ONNX'||preset.engine.revision!=='4a66d7dab72a9e98f24b515d49a1d7a81632df2e')throw Error('Natally adapter requires its existing exact checkpoint.');
  if(wav.length<48044||wav.length>480044||wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE'||wav.toString('ascii',12,16)!=='fmt '||wav.readUInt32LE(16)!==16||wav.readUInt16LE(20)!==1||wav.readUInt16LE(22)!==1||wav.readUInt32LE(24)!==24000||wav.readUInt16LE(34)!==16||wav.toString('ascii',36,40)!=='data'||wav.readUInt32LE(40)!==wav.length-44||wav.readUInt32LE(4)!==wav.length-8)throw Error('Generated reference must be1–10seconds canonical24k mono PCM16 WAV.');
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  if(hash(wav)!==preset.conditioning.sha256)throw Error('Reference content does not match its manifest.');
  const processingRanges={gain:[-24,24],peak:[-12,-.1],gateDb:[-96,-24],highpass:[0,500],low:[-12,12],mid:[-12,12],high:[-12,12],fadeMs:[0,50],rate:[.8,1.4],pitch:[.8,1.4]};
  const generationRanges={temperature:[.2,1.5],topK:[1,6563],topP:[.05,1],repetitionPenalty:[1,2]};
  const processing={},generation={};
  for(const [input,output,ranges,extra] of [[preset.processing,processing,processingRanges,['normalize','tone']],[preset.generation,generation,generationRanges,[]]]){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!Object.hasOwn(ranges,key)&&!extra.includes(key)))throw Error('Unknown private/unsupported control field in production metadata');
    for(const [key,[min,max]] of Object.entries(ranges)){const value=input[key];if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||key==='topK'&&!Number.isInteger(value))throw Error('Invalid control '+key);output[key]=value;}
  }
  if(typeof preset.processing.normalize!=='boolean'||!['natural','warm','soft'].includes(preset.processing.tone))throw Error('Invalid normalization/tone');
  processing.normalize=preset.processing.normalize;processing.tone=preset.processing.tone;
  const c=preset.creator;
  if(c?.appId!=='mba.robin.vociferous-cloner-studio'||c.url!=='https://github.com/rebots-online/vociferous-cloner-studio'||typeof c.version!=='string'||!/^\d+\.\d+\.\d+$/.test(c.version)||typeof c.commit!=='string'||!/^[a-f0-9]{40}(?:\+dirty)?$/.test(c.commit))throw Error('Invalid creating application provenance');
  const creator={appId:c.appId,name:'Vociferous Cloner Studio',url:c.url,version:c.version,commit:c.commit};
  if(typeof preset.exportId!=='string'||!/^[a-f0-9-]{36}$/i.test(preset.exportId)||!Number.isFinite(Date.parse(preset.createdAt)))throw Error('Invalid export identity');
  const base='https://huggingface.co/'+preset.engine.model,revision=preset.engine.revision,files=[];
  if(!Array.isArray(preset.engine.files)||preset.engine.files.length!==13)throw Error('Incomplete model file provenance');
  for(const file of preset.engine.files){if(typeof file.path!=='string'||!/^(?:onnx\/(?:embed_tokens_fp16|speech_encoder_q4f16|language_model_q4f16|conditional_decoder_q4)\.onnx(?:_data)?|(?:config|tokenizer|tokenizer_config|generation_config|preprocessor_config)\.json)$/.test(file.path)||file.url!==base+'/resolve/'+revision+'/'+file.path||!Number.isSafeInteger(file.bytes)||file.bytes<=0||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Invalid exact model file provenance');files.push({path:file.path,url:file.url,bytes:file.bytes,sha256:file.sha256});}
  if(new Set(files.map(f=>f.path)).size!==13)throw Error('Duplicate model paths');
  const engine={adapter:'chatterbox-nano-onnx/v1',model:preset.engine.model,revision,sourceUrl:base,revisionUrl:base+'/tree/'+revision,license:{id:'MIT',url:base+'/blob/'+revision+'/LICENSE',noticeUrl:base+'/blob/'+revision+'/NOTICE.md'},upstream:['https://huggingface.co/ResembleAI/chatterbox-nano','https://github.com/resemble-ai/chatterbox'],runtime:{'onnxruntime-web':'1.31.0-dev.20260914-8d85527a0','@huggingface/transformers':'4.3.1'},files,reference:{sampleRate:24000,channels:1,maxSeconds:10},weightsIncluded:false};
  const modelPath=path.join(root,'src/services/chatterboxModel.ts'),voicePath=path.join(root,'public/voices/chatterbox/F4.wav'),metadataPath=path.join(root,'public/voices/chatterbox/F4.preset.json');
  const read=async file=>{try{return await readFile(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}};
  const same=(a,b)=>a===null||b===null?a===b:a.equals(b);
  const lockPath=path.join(gitDir,'vociferous-voice.lock'),transaction=randomUUID();
  await writeFile(lockPath,transaction,{flag:'wx'}).catch(error=>{throw Error('Consumer voice stage is locked; inspect the existing transaction before retrying. '+error.code);});
  const temporary=[],changes=[];let backup;
  try{
    const modelBytes=await read(modelPath),oldVoice=await read(voicePath),oldMetadata=await read(metadataPath);
    if(!modelBytes||!oldVoice)throw Error('Natally fixed-reference consumer files are missing.');
    const model=modelBytes.toString('utf8'),pattern=/F4: \{ path: 'voices\/chatterbox\/F4\.wav', bytes: \d+, gitBlob: '[a-f0-9]{40}' \}/g;
    if([...model.matchAll(pattern)].length!==1)throw Error('Natally reference schema changed; adapter review required.');
    const blob=createHash('sha1').update(Buffer.from(`blob ${wav.length}\0`)).update(wav).digest('hex');
    const next=Buffer.from(model.replace(pattern,`F4: { path: 'voices/chatterbox/F4.wav', bytes: ${wav.length}, gitBlob: '${blob}' }`));
    const conditioning={file:'finalized-reference.wav',sha256:hash(wav),sampleRate:24000,channels:1,duration:(wav.length-44)/48000,generated:true};
    const metadata={schema:preset.schema,exportId:preset.exportId,createdAt:preset.createdAt,creator,engine,conditioning,processing,generation,consumer:{id:'mba.robin.natally',url:'https://natally.robin.mba',runtimeSampling:'consumer-defaults',processingBakedIntoReference:true},referenceGitBlob:blob};
    changes.push({file:voicePath,before:oldVoice,after:wav,applied:false},{file:modelPath,before:modelBytes,after:next,applied:false},{file:metadataPath,before:oldMetadata,after:Buffer.from(JSON.stringify(metadata,null,2)+'\n'),applied:false});
    backup=path.join(rollbackRoot,transaction);await mkdir(backup,{recursive:true});
    await writeFile(path.join(backup,'rollback.json'),JSON.stringify({transaction,target:root,files:changes.map(c=>({file:c.file,beforeSha256:c.before?hash(c.before):null,afterSha256:hash(c.after)}))},null,2));
    for(const [i,change] of changes.entries()){if(change.before)await writeFile(path.join(backup,String(i)+'.before'),change.before);const temp=change.file+'.'+transaction;await writeFile(temp,change.after,{flag:'wx'});temporary.push(temp);}
    for(const [index,change] of changes.entries()){
      for(const check of changes)if(!same(await read(check.file),check.applied?check.after:check.before))throw Error('Concurrent consumer change detected: '+path.basename(check.file));
      await rename(temporary[index],change.file);change.applied=true;
    }
    for(const change of changes)if(!same(await read(change.file),change.after))throw Error('Consumer changed during stage: '+path.basename(change.file));
    return {staged:true,target:root,changed:['public/voices/chatterbox/F4.wav','public/voices/chatterbox/F4.preset.json','src/services/chatterboxModel.ts'],rollback:backup,publication:'Not committed, pushed or deployed. Review/build/deploy the consumer repository separately.'};
  }catch(error){
    const preserved=[];
    for(const change of [...changes].reverse())if(change.applied){if(!same(await read(change.file),change.after)){preserved.push(path.basename(change.file));continue;}if(change.before){const temp=change.file+'.rollback-'+transaction;await writeFile(temp,change.before,{flag:'wx'});if(same(await read(change.file),change.after))await rename(temp,change.file);else{preserved.push(path.basename(change.file));await unlink(temp);}}else if(same(await read(change.file),change.after))await unlink(change.file);}
    throw Error(error.message+(backup?' Rollback record: '+backup:'')+(preserved.length?' Newer external edits preserved: '+preserved.join(', '):''));
  }finally{
    for(const temp of temporary)try{await unlink(temp);}catch(error){if(error.code!=='ENOENT')console.error('Retained temporary stage file:',temp);}
    if((await read(lockPath))?.toString()===transaction)await unlink(lockPath);
  }
}
