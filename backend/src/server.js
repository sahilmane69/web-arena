import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

const app = express()
const port = process.env.PORT || 3001
const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const agentDirectory = path.resolve(serverDirectory, '../../agent')
const python = path.join(agentDirectory, '.venv', 'bin', 'python')
const tasks = new Map()
const connectedTabs = new Map()
const commandResults = new Map()

app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.post('/api/tasks', (request, response) => {
  const { url, task, maxSteps = 10, connectionId } = request.body

  if (typeof url !== 'string' || !url.trim() || typeof task !== 'string' || !task.trim()) {
    return response.status(400).json({ error: 'url and task are required.' })
  }
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 20) {
    return response.status(400).json({ error: 'maxSteps must be an integer from 1 to 20.' })
  }
  if (connectionId && !connectedTabs.has(connectionId)) {
    return response.status(400).json({ error: 'The selected browser tab is no longer connected.' })
  }

  const id = randomUUID()
  const agentTask = {
    id,
    url: url.trim(),
    task: task.trim(),
    status: 'running',
    logs: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    result: null,
  }
  tasks.set(id, agentTask)

  const args = ['main.py', agentTask.url, agentTask.task, '--max-steps', String(maxSteps)]
  if (connectionId) {
    args.push('--connected-tab', '--browser-api', `http://127.0.0.1:${port}`, '--connection-id', connectionId)
  }

  const agentProcess = spawn(python, args, {
    cwd: agentDirectory,
    env: process.env,
  })

  agentProcess.stdout.on('data', (chunk) => addLogs(agentTask, chunk.toString()))
  agentProcess.stderr.on('data', (chunk) => addLogs(agentTask, chunk.toString()))
  agentProcess.on('error', (error) => {
    agentTask.status = 'failed'
    agentTask.result = error.message
    agentTask.finishedAt = new Date().toISOString()
    addLogs(agentTask, `Could not start the Python agent: ${error.message}`)
  })
  agentProcess.on('close', (code) => {
    if (agentTask.status === 'failed') return
    agentTask.finishedAt = new Date().toISOString()
    agentTask.status = code === 0 ? (agentTask.logs.some((line) => line.startsWith('Stopped after')) ? 'stopped' : 'completed') : 'failed'
    agentTask.result = agentTask.logs.at(-1) || `Python agent exited with code ${code}.`
  })

  response.status(202).json({ id })
})

app.get('/api/tasks/:id', (request, response) => {
  const agentTask = tasks.get(request.params.id)
  if (!agentTask) return response.status(404).json({ error: 'Task not found.' })
  response.json(agentTask)
})

app.get('/api/connected-tabs', (_request, response) => {
  response.json([...connectedTabs.values()].map(({ id, title, url }) => ({ id, title, url })))
})

// These endpoints are used only by the locally installed Chrome extension.
app.post('/api/extension/connect', (request, response) => {
  const { tabId, title, url } = request.body
  if (!Number.isInteger(tabId) || typeof url !== 'string') {
    return response.status(400).json({ error: 'tabId and url are required.' })
  }
  const id = randomUUID()
  connectedTabs.set(id, { id, tabId, title: title || 'Connected tab', url, commands: [] })
  response.json({ connectionId: id })
})

app.post('/api/extension/disconnect', (request, response) => {
  connectedTabs.delete(request.body.connectionId)
  response.status(204).end()
})

app.get('/api/extension/commands', (request, response) => {
  const connection = connectedTabs.get(request.query.connectionId)
  if (!connection) return response.status(404).json({ error: 'Tab connection not found.' })
  response.json(connection.commands.shift() || null)
})

app.post('/api/extension/commands/:id/result', (request, response) => {
  const pending = commandResults.get(request.params.id)
  if (!pending) return response.status(404).json({ error: 'Command not found.' })
  clearTimeout(pending.timeout)
  commandResults.delete(request.params.id)
  pending.resolve(request.body)
  response.status(204).end()
})

app.post('/api/connected-tabs/:connectionId/commands', async (request, response) => {
  const connection = connectedTabs.get(request.params.connectionId)
  if (!connection) return response.status(404).json({ error: 'Tab connection not found.' })

  const command = { id: randomUUID(), ...request.body }
  connection.commands.push(command)
  try {
    const result = await waitForCommandResult(command.id)
    if (result.error) return response.status(422).json(result)
    response.json(result)
  } catch (error) {
    response.status(504).json({ error: error.message })
  }
})

function waitForCommandResult(commandId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      commandResults.delete(commandId)
      reject(new Error('The connected Chrome tab did not respond in time.'))
    }, 30000)
    commandResults.set(commandId, { resolve, timeout })
  })
}

function addLogs(agentTask, output) {
  for (const line of output.split(/\r?\n/)) {
    if (line.trim()) agentTask.logs.push(line)
  }
  agentTask.logs = agentTask.logs.slice(-200)
}

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
