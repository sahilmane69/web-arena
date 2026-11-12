const API = 'http://127.0.0.1:3001'
let polling = false

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'connect-tab') {
    connectTab(message.tab).then(sendResponse).catch((error) => sendResponse({ error: error.message }))
    return true
  }
})

async function connectTab(tab) {
  if (!tab?.id || !tab.url?.startsWith('http')) throw new Error('Open a normal website tab first.')
  try {
    await chrome.debugger.attach({ tabId: tab.id }, '1.3')
  } catch (error) {
    if (!String(error.message).includes('Another debugger')) throw error
  }
  const response = await fetch(`${API}/api/extension/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabId: tab.id, title: tab.title, url: tab.url }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Could not connect this tab.')
  await chrome.storage.local.set({ connection: { ...data, tabId: tab.id } })
  pollCommands()
  return data
}

async function pollCommands() {
  if (polling) return
  polling = true
  while (true) {
    const { connection } = await chrome.storage.local.get('connection')
    if (!connection) break
    try {
      const response = await fetch(`${API}/api/extension/commands?connectionId=${connection.connectionId}`)
      if (!response.ok) throw new Error('The local server is not available.')
      const command = await response.json()
      if (command) {
        const result = await runCommand(connection.tabId, command)
        await fetch(`${API}/api/extension/commands/${command.id}/result`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result),
        })
      } else {
        await pause(400)
      }
    } catch (error) {
      console.warn('WebArena connector:', error)
      await pause(1000)
    }
  }
  polling = false
}

async function runCommand(tabId, command) {
  try {
    if (command.type === 'navigate') {
      await chrome.debugger.sendCommand({ tabId }, 'Page.navigate', { url: command.target })
      await pause(700)
      return { ok: true }
    }
    if (command.type === 'screenshot') {
      await chrome.debugger.sendCommand({ tabId }, 'Page.captureScreenshot', { format: 'png' })
      return { ok: true }
    }
    const result = await evaluate(tabId, actionScript(command))
    return result || { ok: true }
  } catch (error) {
    return { error: error.message }
  }
}

async function evaluate(tabId, expression) {
  const result = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}

function actionScript(command) {
  const input = JSON.stringify(command)
  return `(() => {
    const command = ${input};
    const visible = element => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const labelText = element => element.labels ? [...element.labels].map(label => label.innerText).join(' ') : '';
    const roleOf = element => element.getAttribute('role') || (element.tagName === 'BUTTON' ? 'button' : element.tagName === 'A' ? 'link' : element.type === 'search' ? 'searchbox' : ['INPUT', 'TEXTAREA'].includes(element.tagName) ? 'textbox' : '');
    const nameOf = element => (element.getAttribute('aria-label') || labelText(element) || element.innerText || element.value || element.placeholder || '').trim();
    const controls = () => [...document.querySelectorAll('a[href], button, input:not([type=hidden]), textarea, select, [role], [contenteditable=true]')].filter(visible);
    const findRole = () => controls().find(element => roleOf(element) === command.value && nameOf(element) === command.target);
    const fail = text => { throw new Error(text); };
    if (command.type === 'inspect') {
      return {
        url: location.href,
        title: document.title,
        visible_text: document.body.innerText,
        accessibility_tree: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role],a[href],button,input,textarea,select')].filter(visible).slice(0, 150).map(element => (roleOf(element) || element.tagName.toLowerCase()) + ' ' + nameOf(element)).join('\\n'),
        interactive_elements: controls().slice(0, 100).map(element => ({ tag: element.tagName.toLowerCase(), role: roleOf(element), name: nameOf(element), type: element.type || '', placeholder: element.placeholder || '', href: element.href || '' })),
      };
    }
    if (command.type === 'click_role') { const element = findRole() || fail('Accessible control not found.'); element.click(); return { ok: true }; }
    if (command.type === 'click_text') { const element = controls().find(item => nameOf(item) === command.target) || fail('Text control not found.'); element.click(); return { ok: true }; }
    if (command.type === 'click_selector') { const element = document.querySelector(command.target) || fail('Selector not found.'); element.click(); return { ok: true }; }
    if (command.type === 'fill_label') { const label = [...document.querySelectorAll('label')].find(item => item.innerText.trim() === command.target) || fail('Label not found.'); const element = document.getElementById(label.htmlFor) || label.querySelector('input,textarea'); if (!element) fail('Field for label not found.'); element.value = command.value; element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); return { ok: true }; }
    if (command.type === 'fill_placeholder') { const element = [...document.querySelectorAll('input,textarea')].find(item => item.placeholder === command.target) || fail('Placeholder not found.'); element.value = command.value; element.dispatchEvent(new Event('input', { bubbles: true })); return { ok: true }; }
    if (command.type === 'fill_selector') { const element = document.querySelector(command.target) || fail('Selector not found.'); element.value = command.value; element.dispatchEvent(new Event('input', { bubbles: true })); return { ok: true }; }
    if (command.type === 'type') { const element = document.querySelector(command.target) || fail('Selector not found.'); element.focus(); element.value += command.value; element.dispatchEvent(new Event('input', { bubbles: true })); return { ok: true }; }
    if (command.type === 'search') { const element = controls().find(item => roleOf(item) === 'searchbox') || document.querySelector('input[type=search]') || fail('Search field not found.'); element.value = command.value; element.dispatchEvent(new Event('input', { bubbles: true })); element.form?.requestSubmit(); element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return { ok: true }; }
    throw new Error('Unsupported command.');
  })()`
}

function pause(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)) }
