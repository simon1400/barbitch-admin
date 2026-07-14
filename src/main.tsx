import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// ловим beforeinstallprompt сразу при загрузке (PWA-кнопка в календаре)
import './lib/pwaInstall'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
