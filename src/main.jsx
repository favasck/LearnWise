import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './AuthContext.jsx'
import { supabaseConfigured } from './supabaseClient.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {supabaseConfigured ? <AuthProvider>
      <App />
    </AuthProvider> : <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#FAF8F3', color: '#1F2A2E', fontFamily: 'system-ui, sans-serif', padding: 24, boxSizing: 'border-box' }}>
      <section role="alert" style={{ maxWidth: 480, textAlign: 'center' }}>
        <h1>LearnWise Academy</h1>
        <p>Online services are temporarily unavailable. Please try again later.</p>
      </section>
    </main>}
  </React.StrictMode>,
)
