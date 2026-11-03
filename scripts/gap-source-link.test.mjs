import assert from 'node:assert/strict';
import test from 'node:test';
import {gapSourceLink} from '../src/lib/gap-source-link.js';
import {buildTimelinePreview} from '../src/lib/timeline-preview.js';

test('drafts identify the exact gap but keep typed entries off the public tracker',()=>{
  const context={employer:'Private employer name',title:'Private job title'};
  const preview=buildTimelinePreview({steps:[],context});
  assert.deepEqual(preview.gaps.kinds,['opening','workplace','route']);
  const urls=preview.gaps.kinds.map(kind=>new URL(gapSourceLink(kind,'Registered nurse').href));
  assert.equal(new Set(urls.map(url=>url.searchParams.get('issue'))).size,urls.length);
  for(const url of urls){
    assert.equal(url.host,'github.com');
    assert.equal(url.pathname,'/Fuzzyslippers412/pipeline-map-corrections/issues/new');
    assert.equal(url.searchParams.get('template'),'correction.yml');
    assert.equal(url.searchParams.get('record'),'Registered nurse');
    assert.equal(url.searchParams.has('evidence'),false);
    assert.doesNotMatch(decodeURIComponent(url.href),/Private/i);
  }
  assert.equal(new URL(gapSourceLink('workplace').href).searchParams.get('record'),'Unmatched profession');
  assert.equal(gapSourceLink('Private job title'),null);
});
