import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  const [url, setUrl] = useState('https://example.com')
  const [task, setTask] = useState('Read the page title and stop.')
  const [agentTask, setAgentTask] = useState(null)
  const [error, setError] = useState('')
  const [connectedTabs, setConnectedTabs] = useState([])
  const [connectionId, setConnectionId] = useState('')

  useEffect(() => {
    refreshConnectedTabs()
  }, [])

  useEffect(() => {
    if (!agentTask || agentTask.status !== 'running') return undefined

    const poll = async () => {
      const response = await fetch(`/api/tasks/${agentTask.id}`)
      if (!response.ok) throw new Error('Could not retrieve agent progress.')
      setAgentTask(await response.json())
    }
    const timer = window.setInterval(() => poll().catch((pollError) => setError(pollError.message)), 1000)
    poll().catch((pollError) => setError(pollError.message))
    return () => window.clearInterval(timer)
  }, [agentTask?.id, agentTask?.status])

  async function startTask(event) {
    event.preventDefault()
    setError('')
    setAgentTask(null)

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, task, maxSteps: 10, connectionId: connectionId || undefined }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not start the agent.')
      setAgentTask({ id: data.id, status: 'running', logs: [] })
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const isRunning = agentTask?.status === 'running'

  async function refreshConnectedTabs() {
    try {
      const response = await fetch('/api/connected-tabs')
      const tabs = await response.json()
      if (!response.ok) throw new Error(tabs.error || 'Could not find connected tabs.')
      setConnectedTabs(tabs)
    } catch (tabsError) {
      setError(tabsError.message)
    }
  }

  return (
    <main>
      <p className="eyebrow">WebArena-inspired</p>
      <h1>AI browser agent</h1>
      <p className="description">Give the agent a starting URL and a task. Progress appears below.</p>

      <form onSubmit={startTask} className="task-form">
        <label>
          Starting URL
          <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} required />
        </label>
        <label>
          Task
          <textarea value={task} onChange={(event) => setTask(event.target.value)} required rows="3" />
        </label>
        <label>
          Browser session <span className="optional">(optional)</span>
          <select value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>
            <option value="">Use a new private agent browser</option>
            {connectedTabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.title} — {tab.url}</option>)}
          </select>
        </label>
        <button type="button" className="secondary" onClick={refreshConnectedTabs}>Refresh connected tabs</button>
        <button type="submit" disabled={isRunning}>{isRunning ? 'Agent running…' : 'Start agent'}</button>
      </form>

      {error && <p className="error">{error}</p>}
      {agentTask && (
        <section className="progress" aria-live="polite">
          <div className="progress-heading">
            <h2>Execution progress</h2>
            <span className={`status ${agentTask.status}`}>{agentTask.status}</span>
          </div>
          {agentTask.result && <p className="result">{agentTask.result}</p>}
          <pre>{agentTask.logs?.join('\n') || 'Starting Python agent…'}</pre>
        </section>
      )}
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
