import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Splash from './Splash.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
    <App />
  </StrictMode>,
)
