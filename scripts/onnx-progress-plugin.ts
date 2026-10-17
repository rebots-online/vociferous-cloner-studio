import type { Plugin } from 'vite';

// Instrument the pinned runtime boundary at build time; never rewrite installed
// packages. Fail the build if an upstream update changes this source landmark.
export function patchOnnxRuntime(source: string): string {
  const landmark = 'var InferenceSession = ONNX.InferenceSession;';
  if (source.split(landmark).length !== 2) throw new Error('ONNX session instrumentation landmark changed; review the runtime adapter.');
  return source.replace(landmark, `var InferenceSession = {
    create: async (...args) => {
      const options = args[1] || {};
      const file = options.externalData?.find(value => /\\.onnx_data(?:_\\d+)?$/.test(value.path))?.path;
      const provider = options.executionProviders?.[0];
      const backend = typeof provider === 'string' ? provider : provider?.name;
      const report = event => {
        const hook = globalThis[Symbol.for('natally.onnx.progress')];
        try { if (typeof hook === 'function') hook({ ...event, file, backend }); } catch {}
      };
      const observed = async (operation, work) => {
        const start = performance.now();
        report({ operation, state: 'start' });
        try {
          const result = await work();
          report({ operation, state: 'complete', durationMs: performance.now() - start });
          return result;
        } catch (error) {
          report({ operation, state: 'error', durationMs: performance.now() - start, error: error?.message ?? String(error) });
          throw error;
        }
      };
      const session = await observed('session', () => ONNX.InferenceSession.create(...args));
      const nativeRun = session.run.bind(session);
      session.run = (...inputs) => observed('run', () => nativeRun(...inputs));
      return session;
    }
  };`);
}

export function onnxProgressPlugin(): Plugin {
  return {
    name: 'natally-onnx-progress', enforce: 'pre',
    transform(source, id) {
      if (!id.replace(/\\/g, '/').includes('/@huggingface/transformers/dist/transformers.web.js')) return null;
      return { code: patchFileReadSource(patchOnnxRuntime(source)), map: null };
    },
  };
}

export function patchFileReadSource(source: string): string {
  const landmark = 'status: "download",\n    name: path_or_repo_id,\n    file: filename';
  if (source.split(landmark).length !== 2) throw new Error('Model file-read instrumentation landmark changed; review the runtime adapter.');
  return source.replace(landmark, landmark + ',\n    source: cacheHit ? "cache" : "network"');
}
