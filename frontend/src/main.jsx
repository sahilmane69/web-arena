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

  useEffect(() => { refreshConnectedTabs() }, [])

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

  async function startTask(event) {
    event.preventDefault()
    setError('')
    setAgentTask(null)
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, task, connectionId: connectionId || undefined }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not start the agent.')
      setAgentTask({ id: data.id, status: 'running', logs: [] })
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const isRunning = agentTask?.status === 'running'
  const usesConnectedTab = Boolean(connectionId)

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="WebArena home">
          WebArena
        </a>
      </header>

      <main className="workspace">
        <section className="hero">
          <p className="eyebrow">Browser automation, on your terms</p>
          <h1>Give work to your browser.</h1>
          <p>WebArena completes multi-step web tasks and keeps you informed in plain language.</p>
        </section>

        <div className="dashboard">
          <section className="panel task-panel">
            <div className="panel-heading">
              <div><h2>What should the agent do?</h2></div>
            </div>
            <form onSubmit={startTask} className="task-form">
              <label>
                Starting URL
                <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} required />
              </label>
              <label>
                Describe the task
                <textarea value={task} onChange={(event) => setTask(event.target.value)} required rows="4" />
              </label>
              <div className="session-row">
                <label>
                  Browser session
                  <select value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>
                    <option value="">Private agent browser</option>
                    {connectedTabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.title} — {tab.url}</option>)}
                  </select>
                </label>
                <button type="button" className="text-button" onClick={refreshConnectedTabs}>Refresh tabs</button>
              </div>
              <p className="session-help">{usesConnectedTab ? 'Using your connected tab and its signed-in session.' : 'A separate private browser session will be used.'}</p>
              <button className="primary-button" type="submit" disabled={isRunning}>
                <span>{isRunning ? 'Working on it…' : 'Run task'}</span><span aria-hidden="true">→</span>
              </button>
            </form>
          </section>

          <section className="panel activity-panel" aria-live="polite">
            <div className="panel-heading">
              <div><p className="section-kicker">Live activity</p><h2>{agentTask ? 'Task progress' : 'Ready when you are'}</h2></div>
              {agentTask && <span className={`status ${agentTask.status}`}>{agentTask.status}</span>}
            </div>
            {!agentTask && <div className="empty-state"><span className="empty-icon">✦</span><p>Start a task to see the agent’s progress here.</p></div>}
            {agentTask && <>
              <p className="result">{agentTask.result || (isRunning ? 'The agent is reading the page and choosing its next move.' : '')}</p>
              <ol className="activity-log">
                {(agentTask.logs?.length ? agentTask.logs : ['Getting the browser ready…']).map((log, index) => <li key={`${log}-${index}`}>{log}</li>)}
              </ol>
            </>}
          </section>
        </div>
        {error && <p className="error-message">{error}</p>}
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
