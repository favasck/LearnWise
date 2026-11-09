// Views enforce row authorization and mask private fields in PostgreSQL.
// Base-table mutations return only IDs; callers reload through the protected view.
const protectedTables = new Set(['students','parents','tutors','classes','invoices','payments']);
export function portalSelection(columns) {
  if (typeof columns !== 'string') return columns;
  return columns.replace(/\b(students|parents|tutors|classes|invoices|payments)(?=\s*\()/g, 'portal_$1');
}
export function createPortalClient(client) {
  if (!client) return null;
  return {
    rpc: (...args) => client.rpc(...args),
    from(table) {
      return {
        select(columns='*', options) {
          return client.from(protectedTables.has(table) ? `portal_${table}` : table)
            .select(portalSelection(columns), options);
        },
        ...Object.fromEntries(['insert','update','delete'].map(method => [method, (...args) => {
          const query = client.from(table)[method](...args);
          if (!protectedTables.has(table)) return query;
          // Supabase builders chain through eq/in/order before select. Override only
          // representation selection; writes still target the real RLS-protected table.
          const select = query.select.bind(query);
          query.select = () => select('id');
          return query;
        }])),
      };
    },
  };
}
