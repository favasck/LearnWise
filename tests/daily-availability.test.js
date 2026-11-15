import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyAvailability } from '../src/services/dailyAvailability.js';

const form={date_from:'2030-01-03',date_to:'2030-01-05',time_from:'14:00',time_to:'19:00',mode:'Online',buffer_min:30,tutor_id:'tutor'};
test('inclusive daily windows preserve Qatar hours without overnight availability',()=>{
  const windows=dailyAvailability(form);
  assert.equal(windows.length,3);
  assert.equal(windows[0].starts_at,'2030-01-03T11:00:00.000Z');
  assert.equal(windows[2].ends_at,'2030-01-05T16:00:00.000Z');
  assert.ok(windows.every(w=>Date.parse(w.ends_at)-Date.parse(w.starts_at)===5*3600000));
  assert.equal(dailyAvailability({...form,time_from:'09:00',time_to:'16:00'})[0].starts_at,'2030-01-03T06:00:00.000Z');
});
test('Fridays are optionally excluded and empty ranges rejected',()=>{
  assert.deepEqual(dailyAvailability({...form,exclude_fridays:true}).map(w=>w.starts_at.slice(0,10)),['2030-01-03','2030-01-05']);
  assert.throws(()=>dailyAvailability({...form,date_from:'2030-01-04',date_to:'2030-01-04',exclude_fridays:true}),/No dates remain/);
  assert.equal(dailyAvailability({...form,date_to:form.date_from}).length,1);
});
test('invalid dates and inverted daily hours are rejected',()=>{
  for(const change of [{date_to:'2030-01-01'},{date_from:'2030-02-30'},{time_to:'14:00'},{time_to:'09:00'},{time_from:''}])
    assert.throws(()=>dailyAvailability({...form,...change}));
});
