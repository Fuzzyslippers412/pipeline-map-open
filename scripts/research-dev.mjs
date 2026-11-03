import {fileURLToPath} from 'node:url';
const endpoint=fileURLToPath(new URL('./research-dev-endpoint.js',import.meta.url));
export default {
  name:'pipeline-map-local-research',
  hooks:{'astro:config:setup':({command,injectRoute})=>{
    if(command==='dev')injectRoute({pattern:'/api/research',entrypoint:endpoint,prerender:false});
  }}
};
