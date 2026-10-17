import {defineConfig} from 'vite';
import {onnxProgressPlugin} from './scripts/onnx-progress-plugin.ts';
export default defineConfig({plugins:[onnxProgressPlugin()],worker:{plugins:()=>[onnxProgressPlugin()]},optimizeDeps:{exclude:['@huggingface/transformers']},server:{host:'127.0.0.1',strictPort:true,hmr:false,allowedHosts:['127.0.0.1','localhost'],cors:false},build:{sourcemap:false}});
