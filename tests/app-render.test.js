import { createServer as createHttpServer } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

test('application renders the real public homepage and account failure screens', async t => {
  const server = await createServer({ configFile: false, cacheDir: 'node_modules/.vite-render-tests', ssr: { optimizeDeps: { noDiscovery: true, include: [] } }, server: { middlewareMode: true, hmr: { server: createHttpServer() } }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const { default: App } = await server.ssrLoadModule('/src/App.jsx');
    const { AuthContext, AuthProvider } = await server.ssrLoadModule('/src/AuthContext.jsx');
    const render = value => renderToString(React.createElement(AuthContext.Provider,
      { value: { user: null, profile: null, loading: false, signOut() {}, refreshProfile() {}, ...value } },
      React.createElement(App)));
    await t.test('public homepage renders navigation and learning content without a session', () => {
      const html = render({});
      assert.match(html, /LearnWise/);
      assert.match(html, /Smart Guidance/);
      assert.match(html, /Book Assessment/);
      assert.match(html, /<nav/);
    });
    await t.test('real auth provider renders homepage when backend configuration is absent', () => {
      const html = renderToString(React.createElement(AuthProvider, null, React.createElement(App)));
      assert.match(html, /Smart Guidance/);
      assert.match(html, /Book Assessment/);
      assert.match(html, /<nav/);
    });
    await t.test('session failure renders retry rather than empty content', () => {
      const html = render({ user: { id: 'test' }, profile: { id: 'test', role: 'admin' }, authError: 'Unavailable' });
      assert.match(html, /Unable to load your account/);
      assert.match(html, /Retry/);
    });
    await t.test('public homepage survives backend session loading and failure', () => {
      for (const value of [{ loading: true }, { authError: 'Unavailable' }]) {
        assert.match(render(value), /Smart Guidance/);
      }
    });
    await t.test('unknown role does not render an admin portal', () => {
      const html = render({ user: { id: 'test' }, profile: { id: 'test', role: 'unknown', status: 'Active' } });
      assert.match(html, /contact the admin/);
      assert.doesNotMatch(html, /All Users/);
    });
  } finally { await server.close(); }
});
