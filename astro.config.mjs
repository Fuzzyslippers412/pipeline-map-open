import { defineConfig } from 'astro/config';
import researchDev from './scripts/research-dev.mjs';
export default defineConfig({ integrations: [researchDev], site: 'https://pipeline-map.fuzzyslipper.chatgpt.site', trailingSlash: 'always', output: 'static', build: { inlineStylesheets: 'always' }, devToolbar: { enabled: false } });
