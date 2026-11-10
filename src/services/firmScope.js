let scope=null;
export function setFirmScope(firmId,userId){scope=firmId&&userId?{firmId,userId}:null;}
export function clearFirmScope(userId){if(!userId||scope?.userId===userId)scope=null;}
export function firmPayload(data){if(!scope)throw Error('Choose a firm first.');return{...data,firm_id:scope.firmId};}
const scoped=new Set(['students','parents','tutors','student_tutors','classes','class_notes','homework','materials','invoices','payments','payment_balances','audit_logs']);
const unavailable=()=>{let chain;chain=new Proxy({},{get(_t,key){if(key==='then')return resolve=>Promise.resolve({data:null,error:{message:'Choose a firm first.'}}).then(resolve);return()=>chain;}});return chain;};
export function scopedClient(client){
 if(!client)return null;
 return{rpc:(...args)=>client.rpc(...args),from(table){
  const selected=scoped.has(table)?scope?.firmId:null;
  if(scoped.has(table)&&!selected)return unavailable();
  const narrow=q=>selected?q.eq('firm_id',selected):q;
  return{select:(...args)=>narrow(client.from(table).select(...args)),insert:(data,...args)=>client.from(table).insert(selected?(Array.isArray(data)?data.map(row=>({...row,firm_id:selected})):{...data,firm_id:selected}):data,...args),update:(...args)=>narrow(client.from(table).update(...args)),delete:(...args)=>narrow(client.from(table).delete(...args))};
 }};
}
