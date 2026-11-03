import {handleResearch} from '../worker/research.js';
export const prerender=false;
export const ALL=({request})=>handleResearch(request);
