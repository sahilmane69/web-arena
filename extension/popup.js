const button = document.querySelector('#connect')
const status = document.querySelector('#status')

button.addEventListener('click', async () => {
  button.disabled = true
  status.textContent = 'Connecting…'
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const result = await chrome.runtime.sendMessage({ type: 'connect-tab', tab })
  status.textContent = result.error || `Connected: ${tab.title || tab.url}`
  button.disabled = Boolean(!result.error)
})
