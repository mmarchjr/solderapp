import { ref } from 'vue'

const isConnected = ref(false)
const portName = ref('')
const firmwareInfo = ref('')
const port = ref(null)
const reader = ref(null)
const writer = ref(null)
const dataCallbacks = ref([])
let readLoop = null
let keepAliveInterval = null

function getLineEnding() {
  const ending = localStorage.getItem('solderLineEnding') || '\n'
  return ending === 'CRLF' ? '\r\n' : ending === 'CR' ? '\r' : ending === 'None' ? '' : '\n'
}

async function connect() {
  if (isConnected.value) return

  try {
    port.value = await navigator.serial.requestPort()
    const baudRate = parseInt(localStorage.getItem('solderBaudRate') || '115200', 10)
    await port.value.open({ baudRate })

    const decoder = new TextDecoderStream()
    const encoder = new TextEncoderStream()
    const inputDone = port.value.readable.pipeTo(decoder.writable)
    const outputDone = encoder.readable.pipeTo(port.value.writable)

    reader.value = decoder.readable.getReader()
    writer.value = encoder.writable.getWriter()

    isConnected.value = true
    portName.value = port.value.getInfo().usbVendorName
      ? `${port.value.getInfo().usbVendorName} (Port)`
      : 'Serial Port'

    startReadLoop()

    const response = await sendWithResponse('M115', 'FIRMWARE_NAME', 3000)
    if (response) {
      const match = response.match(/FIRMWARE_NAME:\s*(\S+)/)
      firmwareInfo.value = match ? match[1].replace(/;.*$/, '') : 'Unknown Firmware'
    }
  } catch (err) {
    console.error('Serial connection failed:', err)
    await disconnect()
    throw err
  }
}

async function disconnect() {
  stopReadLoop()
  stopKeepAlive()

  if (reader.value) {
    try {
      await reader.value.cancel()
    } catch {
      throw new Error('Failed to cancel reader')
    }
    try {
      reader.value.releaseLock()
    } catch {
      throw new Error('Failed to release reader lock')
    }
    reader.value = null
  }
  if (writer.value) {
    try {
      writer.value.releaseLock()
    } catch {
      throw new Error('Failed to release writer lock')
    }
    writer.value = null
  }
  if (port.value) {
    try {
      await port.value.close()
    } catch {
      throw new Error('Failed to close port')
    }
    port.value = null
  }

  isConnected.value = false
  portName.value = ''
  firmwareInfo.value = ''
}

function startReadLoop() {
  readLoop = (async () => {
    while (isConnected.value && reader.value) {
      try {
        const { value, done } = await reader.value.read()
        if (done) break
        if (value) {
          const lines = value.split('\n').filter((l) => l.trim().length > 0)
          for (const line of lines) {
            for (const cb of dataCallbacks.value) {
              cb(line.trim())
            }
          }
        }
      } catch (err) {
        if (isConnected.value) {
          console.error('Read error:', err)
          for (const cb of dataCallbacks.value) {
            cb('[ERROR] Read failed: ' + err.message)
          }
        }
        break
      }
    }
  })()
}

function stopReadLoop() {
  if (readLoop) {
    readLoop = null
  }
}

function onData(callback) {
  dataCallbacks.value.push(callback)
  return () => {
    dataCallbacks.value = dataCallbacks.value.filter((cb) => cb !== callback)
  }
}

async function send(line) {
  if (!writer.value || !isConnected.value) {
    throw new Error('Not connected')
  }
  const ending = getLineEnding()
  await writer.value.write(line + ending)
}

async function sendWithResponse(command, expectedPrefix, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let resolved = false
    let timeoutId

    const unsub = onData((line) => {
      if (
        !resolved &&
        (line.includes(expectedPrefix) || line.startsWith('ok') || line.startsWith('Error'))
      ) {
        resolved = true
        clearTimeout(timeoutId)
        unsub()
        resolve(line)
      }
    })

    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        unsub()
        resolve(null)
      }
    }, timeoutMs)

    send(command).catch(() => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        unsub()
        resolve(null)
      }
    })
  })
}

function startKeepAlive(intervalMs = 2000) {
  stopKeepAlive()
  keepAliveInterval = setInterval(() => {
    if (isConnected.value) {
      send('M105').catch(() => {})
    }
  }, intervalMs)
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
    keepAliveInterval = null
  }
}

export function useSerial() {
  return {
    isConnected,
    portName,
    firmwareInfo,
    connect,
    disconnect,
    send,
    sendWithResponse,
    onData,
    startKeepAlive,
    stopKeepAlive
  }
}
