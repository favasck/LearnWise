// Keep configuration failures out of module initialization so the entry point
// can keep public pages available without inventing a backend or credentials.
export function initializeSupabase(createClient, url, publicKey) {
  if (!url || !publicKey) return { client: null, configured: false };
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return { client: null, configured: false };
    return { client: createClient(url, publicKey), configured: true };
  } catch {
    return { client: null, configured: false };
  }
}
