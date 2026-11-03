import { defineConfig } from 'astro/config';
import researchDev from './scripts/research-dev.mjs';
export default defineConfig({ integrations: [researchDev], site: 'https://doornotes.org', trailingSlash: 'always', output: 'static', build: { inlineStylesheets: 'always' }, devToolbar: { enabled: false } });
