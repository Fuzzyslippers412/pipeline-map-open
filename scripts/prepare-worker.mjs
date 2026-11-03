import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Package the verified Astro export as Cloudflare static assets, alongside a
// small Worker handling same-origin research. Compile first so an invalid Worker
// cannot replace the static build. Keep source and build manifests identical.
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
let manifest;
try {
  manifest = await fs.readFile(path.join(root, '.openai/hosting.json'), 'utf8');
} catch (error) {
  // The open-source checkout can build and run on any Cloudflare account.
  if (error.code !== 'ENOENT') throw error;
}
const config = JSON.parse(await fs.readFile(path.join(root, 'wrangler.json'), 'utf8'));

if (manifest) {
  const hosting = JSON.parse(manifest);
  if (!hosting.project_id || hosting.static != null) throw new Error('The private Sites configuration must declare its project ID and omit static mode.');
}
await fs.access(path.join(dist, 'index.html'));
await fs.access(path.join(dist, 'p/physician/og.png'));
await fs.mkdir(path.join(root,'.astro'), { recursive: true });
const stage = await fs.mkdtemp(path.join(root,'.astro/worker-artifact-'));
const client = path.join(stage,'client');
let movedClient = false;
try {
  await fs.mkdir(path.join(stage,'server'), { recursive: true });
  await build({
    stdin: {
      contents: `import research from './worker/research.js';
export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/research') return research.fetch(request, env, ctx);
    if (url.pathname.startsWith('/api/')) return new Response('Unknown API route', { status: 404 });
    return env.ASSETS.fetch(request);
  }
};`,
      resolveDir: root,
      sourcefile: 'pipeline-map-worker-entry.mjs',
    },
    format: 'esm', bundle: true, platform: 'browser', target: 'es2022',
    outfile: path.join(stage,'server/index.js'),
    legalComments: 'inline',
  });
  if (manifest) {
    await fs.mkdir(path.join(stage,'.openai'), { recursive: true });
    await fs.writeFile(path.join(stage,'.openai/hosting.json'),manifest);
  }
  // Like the Sites Vinext output, the deployable Wrangler config resolves
  // paths from dist/server/. Keep the root config usable for local previews.
  const builtConfig = { ...config, main: 'index.js', no_bundle: true,
    assets: { ...config.assets, directory:'../client' } };
  await fs.writeFile(path.join(stage,'server/wrangler.json'),JSON.stringify(builtConfig,null,2)+'\n');
  await fs.rename(dist,client);
  movedClient = true;
  await fs.rename(stage,dist);
  movedClient = false;
  console.log('Prepared Sites Worker. Public files in dist/client; research endpoint in dist/server/index.js.');
} catch (error) {
  if (movedClient) await fs.rename(client,dist);
  await fs.rm(stage, { recursive:true, force:true });
  throw error;
}
