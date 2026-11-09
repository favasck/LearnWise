// Persist only a payload digest and request UUID, never payment/contact details.
// Keep uncertain requests across reloads so a retry cannot post the same save twice.
export async function billingRequest(kind, actorId, payload, action, storage, cryptoApi) {
  if (!actorId) return {data:null,error:{message:'Please sign in again before recording billing.'}};
  try {
    storage ??= globalThis.localStorage;
    cryptoApi ??= globalThis.crypto;
    const serialized=JSON.stringify(Object.fromEntries(Object.keys(payload).sort().map(k=>{
      const value=payload[k];
      if(['amount_qar','subtotal_qar','discount_qar'].includes(k)) {
        const match=String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
        if(match)return [k,match[1].replace(/^0+(?=\d)/,'')+'.'+(match[2]||'').padEnd(2,'0')];
      }
      return [k,value];
    })));
    const digest=await cryptoApi.subtle.digest('SHA-256',new TextEncoder().encode(serialized));
    const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const key=`learnwise:billing:${actorId}:${kind}:${hash}`;
    const requestId=storage.getItem(key)||cryptoApi.randomUUID();
    // Do not start a remote save unless its retry identity was durably stored.
    storage.setItem(key,requestId);
    const result=await action(payload,requestId);
    if (!result.error) {
      try { storage.removeItem(key); } catch { /* The saved UUID safely deduplicates later retries. */ }
    }
    return result;
  } catch {
    return {data:null,error:{message:'Unable to confirm this save. Keep the same details and retry; check existing records before starting a different payment.'}};
  }
}
