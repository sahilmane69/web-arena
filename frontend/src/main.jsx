import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  return (
    <main>
      <p className="eyebrow">WebArena-inspired</p>
      <h1>AI browser agent</h1>
      <p className="description">
        Starter interface. Browser tasks and agent controls will be added here.
      </p>
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
