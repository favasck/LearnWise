// The client is injected so messaging can be verified without a live account.
export function createMessagingService(client) {
  return {
    contacts: () => client.rpc('message_contacts'),
    inbox: () => client.rpc('message_inbox'),
    thread: (userId, peerId, page=0) => client.from('direct_messages').select('*')
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${userId})`)
      .order('created_at', {ascending:false}).order('id', {ascending:false}).range(page*50,page*50+49),
    send: (senderId,recipientId,body,id) => client.from('direct_messages')
      .insert({id,sender_id:senderId,recipient_id:recipientId,body:body.trim()}).select().single(),
    markRead: (userId,ids) => client.from('direct_messages').update({read_at:new Date().toISOString()})
      .eq('recipient_id',userId).in('id',ids).is('read_at',null),
  };
}

export function mergeMessages(older,newer) {
  return [...new Map([...older,...newer].map(m=>[m.id,m])).values()]
    .sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
}
