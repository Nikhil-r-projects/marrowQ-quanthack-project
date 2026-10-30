import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource-variable/source-serif-4/opsz.css'
import './index.css'
import App from './App.tsx'

// After a deploy, an open tab may request lazy chunks that no longer exist; reload once to pick up the new build.
window.addEventListener('vite:preloadError', event => {
  if (sessionStorage.getItem('marrowq.reloaded')) return
  sessionStorage.setItem('marrowq.reloaded', '1')
  event.preventDefault()
  window.location.reload()
})
window.addEventListener('load', () => setTimeout(() => sessionStorage.removeItem('marrowq.reloaded'), 10000))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
