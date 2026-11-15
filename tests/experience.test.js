import {test} from 'node:test';
import assert from 'node:assert/strict';
import {academyDate,academyDayRange,nextLesson,homeworkOrder,safeMeetingUrl} from '../src/features/experience.js';

test('Qatar day boundaries remain correct when UTC is still on the previous day',()=>{
  assert.equal(academyDate('2026-11-15T22:30:00Z'),'2026-11-16');
  assert.deepEqual(academyDayRange('2026-11-15T22:30:00Z'),{from:'2026-11-16T00:00:00+03:00',to:'2026-11-16T23:59:59.999+03:00'});
});
test('next lesson excludes removed, cancelled and ended lessons and includes an ongoing lesson',()=>{
  const now=Date.parse('2026-11-15T10:30:00Z');
  const rows=[
    {id:'later',scheduled_at:'2026-11-16T10:00:00Z',status:'Scheduled'},
    {id:'cancelled',scheduled_at:'2026-11-15T10:00:00Z',status:'Cancelled'},
    {id:'removed',scheduled_at:'2026-11-15T10:00:00Z',status:'Scheduled',deleted_at:'today'},
    {id:'ended',scheduled_at:'2026-11-15T08:00:00Z',duration_min:60,status:'Scheduled'},
    {id:'ongoing',scheduled_at:'2026-11-15T10:00:00Z',duration_min:60,status:'Scheduled'},
  ];
  assert.equal(nextLesson(rows,now).id,'ongoing');
  assert.equal(rows[0].id,'later');
  assert.equal(nextLesson([],now),null);
});
test('lesson links accept HTTPS only and homework puts undated tasks last without mutating data',()=>{
  assert.equal(safeMeetingUrl('javascript:alert(1)'),null);
  assert.equal(safeMeetingUrl('http://example.test'),null);
  assert.equal(safeMeetingUrl('/relative'),null);
  assert.equal(safeMeetingUrl('https://example.test/lesson'),'https://example.test/lesson');
  const rows=[{id:'undated'},{id:'late',due_at:'2026-12-02'},{id:'early',due_at:'2026-12-01'},{id:'removed',due_at:'2026-11-01',deleted_at:'yes'}];
  assert.deepEqual(homeworkOrder(rows).map(r=>r.id),['early','late','undated']);
  assert.equal(rows[0].id,'undated');
});
