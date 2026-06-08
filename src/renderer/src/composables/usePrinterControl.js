import { ref, computed } from 'vue'
import { useDrillStore } from '@/stores/store'
import { useSerial } from './useSerial'
import { useGcodeGenerator } from './useGcodeGenerator'

const jogStep = ref(1)
const jogFeedXy = ref(3000)
const jogFeedZ = ref(1500)
const isRelativeMode = ref(false)
const printLines = ref([])
const printAbortController = ref(null)
const positionSyncInterval = ref(null)
const sentCallbacks = ref([])

export function usePrinterControl() {
  const drillStore = useDrillStore()
  const serial = useSerial()
  const gcodeGen = useGcodeGenerator()

  const printer = computed(() => ({
    get connected() {
      return drillStore.printerConnected
    },
    set connected(v) {
      drillStore.printerConnected = v
    },
    get portName() {
      return drillStore.printerPortName
    },
    set portName(v) {
      drillStore.printerPortName = v
    },
    get firmware() {
      return drillStore.printerFirmware
    },
    set firmware(v) {
      drillStore.printerFirmware = v
    },
    get homed() {
      return drillStore.printerHomed
    },
    set homed(v) {
      drillStore.printerHomed = v
    },
    get position() {
      return drillStore.printerPosition
    },
    set position(v) {
      drillStore.printerPosition = v
    },
    get printing() {
      return drillStore.printerPrinting
    },
    set printing(v) {
      drillStore.printerPrinting = v
    },
    get paused() {
      return drillStore.printerPaused
    },
    set paused(v) {
      drillStore.printerPaused = v
    },
    get currentLine() {
      return drillStore.printerCurrentLine
    },
    set currentLine(v) {
      drillStore.printerCurrentLine = v
    },
    get totalLines() {
      return drillStore.printerTotalLines
    },
    set totalLines(v) {
      drillStore.printerTotalLines = v
    },
    get currentPoint() {
      return drillStore.printerCurrentPoint
    },
    set currentPoint(v) {
      drillStore.printerCurrentPoint = v
    },
    get totalPoints() {
      return drillStore.printerTotalPoints
    },
    set totalPoints(v) {
      drillStore.printerTotalPoints = v
    },
    get currentPcbIndex() {
      return drillStore.printerCurrentPcbIndex
    },
    set currentPcbIndex(v) {
      drillStore.printerCurrentPcbIndex = v
    },
    get feedOverride() {
      return drillStore.printerFeedOverride
    },
    set feedOverride(v) {
      drillStore.printerFeedOverride = v
    },
    get elapsed() {
      return drillStore.printerElapsed
    },
    set elapsed(v) {
      drillStore.printerElapsed = v
    },
    get startTime() {
      return drillStore.printerStartTime
    },
    set startTime(v) {
      drillStore.printerStartTime = v
    }
  }))

  // Helper to set printer properties through the refs
  function setPrinter(key, value) {
    const keyMap = {
      connected: 'printerConnected',
      portName: 'printerPortName',
      firmware: 'printerFirmware',
      homed: 'printerHomed',
      position: 'printerPosition',
      printing: 'printerPrinting',
      paused: 'printerPaused',
      currentLine: 'printerCurrentLine',
      totalLines: 'printerTotalLines',
      currentPoint: 'printerCurrentPoint',
      totalPoints: 'printerTotalPoints',
      currentPcbIndex: 'printerCurrentPcbIndex',
      feedOverride: 'printerFeedOverride',
      elapsed: 'printerElapsed',
      startTime: 'printerStartTime'
    }
    drillStore[keyMap[key]] = value
  }

  async function connect() {
    await serial.connect()
    setPrinter('connected', true)
    setPrinter('portName', serial.portName.value)
    setPrinter('firmware', serial.firmwareInfo.value)
    serial.onData(handleSerialData)
    await serial.send('M17 S0')
  }

  async function disconnect() {
    if (printer.value.printing) {
      await cancelPrint()
    }
    serial.stopKeepAlive()
    await serial.disconnect()
    drillStore.resetPrinterState()
  }

  function handleSerialData(line) {
    if (line === 'ok') {
      return
    }
    if (line.startsWith('X:') || line.includes('Count')) {
      parsePosition(line)
    }
    if (line.startsWith('FIRMWARE_NAME:')) {
      setPrinter(
        'firmware',
        line.match(/FIRMWARE_NAME:\s*(\S+)/)?.[1]?.replace(/;.*$/, '') || 'Unknown'
      )
    }
  }

  function parsePosition(line) {
    const xMatch = line.match(/X:\s*([-\d.]+)/)
    const yMatch = line.match(/Y:\s*([-\d.]+)/)
    const zMatch = line.match(/Z:\s*([-\d.]+)/)
    const pos = { ...printer.value.position }
    if (xMatch) pos.x = parseFloat(xMatch[1])
    if (yMatch) pos.y = parseFloat(yMatch[1])
    if (zMatch) pos.z = parseFloat(zMatch[1])
    setPrinter('position', pos)
  }

  async function ensureRelativeMode() {
    if (!isRelativeMode.value) {
      await serial.send('G91')
      isRelativeMode.value = true
    }
  }

  async function ensureAbsoluteMode() {
    if (isRelativeMode.value) {
      await serial.send('G90')
      isRelativeMode.value = false
    }
  }

  async function home() {
    serial.stopKeepAlive()
    isRelativeMode.value = false
    try {
      await serial.sendWithResponse('G28', 'ok', 30000)
      await serial.send('M17 S0')
    } catch (e) {
      console.error('Home error:', e)
    }
    setPrinter('homed', true)
    serial.startKeepAlive()
  }

  async function jogX(step) {
    if (!printer.value.homed) return
    await serial.send('M17 S0')
    await ensureRelativeMode()
    const newX = printer.value.position.x + step
    if (newX < 0 || newX > (drillStore.currentBedWidth || 235)) return
    await serial.send(`G1 X${step} F${jogFeedXy.value}`)
    const pos = { ...printer.value.position, x: newX }
    setPrinter('position', pos)
  }

  async function jogY(step) {
    if (!printer.value.homed) return
    await serial.send('M17 S0')
    await ensureRelativeMode()
    const newY = printer.value.position.y + step
    if (newY < 0 || newY > (drillStore.currentBedHeight || 235)) return
    await serial.send(`G1 Y${step} F${jogFeedXy.value}`)
    const pos = { ...printer.value.position, y: newY }
    setPrinter('position', pos)
  }

  async function jogZ(step) {
    if (!printer.value.homed) return
    await serial.send('M17 S0')
    await ensureRelativeMode()
    await serial.send(`G1 Z${step} F${jogFeedZ.value}`)
    const pos = { ...printer.value.position, z: printer.value.position.z + step }
    setPrinter('position', pos)
  }

  async function moveTo(x, y) {
    await serial.send('M17 S0')
    await ensureAbsoluteMode()
    const bedW = drillStore.currentBedWidth || 235
    const bedH = drillStore.currentBedHeight || 235
    const clampedX = Math.max(0, Math.min(bedW, x))
    const clampedY = Math.max(0, Math.min(bedH, y))
    await serial.send(`G0 X${clampedX.toFixed(2)} Y${clampedY.toFixed(2)} F${jogFeedXy.value}`)
    setPrinter('position', { x: clampedX, y: clampedY, z: printer.value.position.z })
  }

  async function moveToPreset(preset) {
    const bedW = drillStore.currentBedWidth || 235
    const bedH = drillStore.currentBedHeight || 235
    const presets = {
      'front-left': { x: 0, y: 0 },
      'front-right': { x: bedW, y: 0 },
      'back-left': { x: 0, y: bedH },
      'back-right': { x: bedW, y: bedH },
      center: { x: bedW / 2, y: bedH / 2 }
    }
    const pos = presets[preset]
    if (pos) await moveTo(pos.x, pos.y)
  }

  async function emergencyStop() {
    try {
      await serial.send('M84')
    } catch {}
    if (printer.value.printing) {
      printAbortController.value?.abort()
      setPrinter('printing', false)
      setPrinter('paused', false)
    }
    await serial.disconnect()
    drillStore.resetPrinterState()
  }

  async function pausePrint() {
    if (!printer.value.printing || printer.value.paused) return
    try {
      await serial.send('M84')
    } catch {}
    setPrinter('paused', true)
  }

  async function resumePrint() {
    if (!printer.value.printing || !printer.value.paused) return
    try {
      await serial.send('M17')
      await serial.send('M17 S0')
      await serial.send('G28')
      setPrinter('homed', true)
      setPrinter('paused', false)
      streamFromLine(printer.value.currentLine)
    } catch (err) {
      console.error('Resume failed:', err)
      await cancelPrint()
    }
  }

  async function cancelPrint() {
    printAbortController.value?.abort()
    serial.stopKeepAlive()
    stopPositionSync()
    try {
      await serial.send('M84')
    } catch {}
    resetPrintState()
  }

  function resetPrintState() {
    setPrinter('printing', false)
    setPrinter('paused', false)
    setPrinter('currentLine', 0)
    setPrinter('totalLines', 0)
    setPrinter('currentPoint', 0)
    setPrinter('totalPoints', 0)
    setPrinter('currentPcbIndex', 0)
    setPrinter('elapsed', 0)
    setPrinter('startTime', null)
    printLines.value = []
    stopPositionSync()
  }

  async function startPrint() {
    if (!printer.value.connected || printer.value.printing) return

    const gcode = gcodeGen.generateGcode()
    const lines = gcode.split('\n').filter((l) => l.trim().length > 0)

    printLines.value = lines
    setPrinter('totalLines', lines.length)
    setPrinter('currentLine', 0)
    setPrinter('currentPoint', 0)
    setPrinter('totalPoints', gcodeGen.getSolderPoints().length)
    setPrinter('printing', true)
    setPrinter('paused', false)
    setPrinter('startTime', Date.now())
    setPrinter('elapsed', 0)
    printAbortController.value = new AbortController()

    await serial.send('M17 S0')
    startPositionSync()
    serial.startKeepAlive(2000)

    await ensureAbsoluteMode()
    streamFromLine(0)
  }

  async function streamFromLine(startIndex) {
    const signal = printAbortController.value?.signal
    for (let i = startIndex; i < printLines.value.length; i++) {
      if (signal?.aborted) return
      while (printer.value.paused) {
        await new Promise((r) => setTimeout(r, 100))
        if (signal?.aborted) return
      }

      const rawLine = printLines.value[i]
      const commentIdx = rawLine.indexOf(';')
      const line = (commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine).trim()
      setPrinter('currentLine', i + 1)

      if (line.match(/M117\s+Point\s+(\d+)\/(\d+)/)) {
        const match = line.match(/M117\s+Point\s+(\d+)\/(\d+)/)
        if (match) {
          setPrinter('currentPoint', parseInt(match[1], 10))
          setPrinter('totalPoints', parseInt(match[2], 10))
        }
      }

      if (!line) continue

      try {
        fireSent(line)
        await serial.send(line)
        await waitForOk(5000)
      } catch (err) {
        console.error(`Print error at line ${i}:`, err)
        setPrinter('paused', true)
        return
      }
    }

    resetPrintState()
    serial.stopKeepAlive()
  }

  function waitForOk(timeoutMs = 5000) {
    return new Promise((resolve) => {
      let resolved = false
      let timeoutId

      const unsub = serial.onData((line) => {
        if (!resolved && (line === 'ok' || line.startsWith('ok ') || line.startsWith('Error'))) {
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
          resolve('ok')
        }
      }, timeoutMs)
    })
  }

  function startPositionSync() {
    stopPositionSync()
    positionSyncInterval.value = setInterval(async () => {
      if (printer.value.printing && !printer.value.paused && printer.value.connected) {
        try {
          await serial.send('M114')
        } catch {}
      }
      if (printer.value.startTime) {
        setPrinter('elapsed', Math.floor((Date.now() - printer.value.startTime) / 1000))
      }
    }, 1500)
  }

  function stopPositionSync() {
    if (positionSyncInterval.value) {
      clearInterval(positionSyncInterval.value)
      positionSyncInterval.value = null
    }
  }

  async function jogToPoint(drillPoint, pcb) {
    if (!printer.value.homed || !printer.value.connected) return
    const profile = drillStore.profiles[drillStore.currentProfile]
    const safeZ = profile?.solderSafeZ ?? 15
    await ensureAbsoluteMode()
    if (printer.value.position.z < safeZ) {
      await serial.send(`G0 Z${safeZ} F800`)
      await waitForOk(5000)
    }
    const bedCoords = drillStore.drillToBedSpace(drillPoint, pcb)
    const x = bedCoords.x + (drillPoint.xOffset ?? 0)
    const y = bedCoords.y + (drillPoint.yOffset ?? 0)
    await moveTo(x, y)
  }

  async function solderPoint(drillPoint, pcb) {
    if (!printer.value.connected || printer.value.printing) return

    const profile = drillStore.profiles[drillStore.currentProfile]
    if (!profile) return

    const solderPoints = gcodeGen.getSolderPoints()
    const pointIndex = solderPoints.findIndex(
      (sp) => sp.id === drillPoint.id && sp.pcbId === pcb.id
    )
    if (pointIndex === -1) return

    const point = solderPoints[pointIndex]
    const padArea = Math.PI * Math.pow(parseFloat(point.size) / 2, 2)
    const soakCurve = drillStore.splineCurves.soak
    const feedCurve = drillStore.splineCurves.feed
    const dwellCurve = drillStore.splineCurves.dwell

    const vars = {
      INDEX: 0,
      TOTAL_POINTS: 1,
      X: point.transformedX,
      Y: point.transformedY,
      SOLDER_OFFSET: profile.solderOffset ?? 0,
      X_OFFSET: point.xOffset ?? 0,
      Y_OFFSET: point.yOffset ?? 0,
      Z_OFFSET: (point.zOffset ?? 0) + (point.originOffsetZ ?? 0),
      SOAK:
        soakCurve.length > 0
          ? (gcodeGen.interpolateSpline?.(soakCurve, padArea) ?? point.soak)
          : point.soak,
      FEED:
        feedCurve.length > 0
          ? (gcodeGen.interpolateSpline?.(feedCurve, padArea) ?? point.feed)
          : point.feed,
      DWELL:
        dwellCurve.length > 0
          ? (gcodeGen.interpolateSpline?.(dwellCurve, padArea) ?? point.dwell)
          : point.dwell,
      PRIME: profile.feedPrime ?? 0,
      PRIME_RETRACT: profile.feedRetract ?? 0,
      RETRACT: profile.retractAfterSolder ?? 0,
      SOLDER_SAFE_Z: profile.solderSafeZ ?? 0,
      SOLDER_PRIME_Z: profile.solderPrimeZ ?? 0,
      POINT_NUMBER: 1,
      PROGRESS_PERCENT: 0,
      PCB_THICKNESS: point.pcbThickness,
      PCB_INDEX: point.pcbIndex + 1,
      PCB_NAME: point.pcbName
    }

    let gcode = `G0 Z${profile.solderSafeZ ?? 15} F800\n`
    gcode += gcodeGen.processTemplate(profile.perPointGcode, vars)

    const lines = gcode.split('\n').filter((l) => l.trim().length > 0)

    printLines.value = lines
    setPrinter('totalLines', lines.length)
    setPrinter('currentLine', 0)
    setPrinter('currentPoint', 1)
    setPrinter('totalPoints', 1)
    setPrinter('printing', true)
    setPrinter('paused', false)
    setPrinter('startTime', Date.now())
    setPrinter('elapsed', 0)
    printAbortController.value = new AbortController()

    await serial.send('M17 S0')
    startPositionSync()
    serial.startKeepAlive(2000)

    await ensureAbsoluteMode()
    streamFromLine(0)
  }

  function processTemplate(template, variables) {
    let processed = template
    processed = processed.replace(/\{INDEX\s*\+\s*1\}/g, '{POINT_NUMBER}')
    processed = processed.replace(/\{INDEX\s*\/\s*TOTAL_POINTS\s*\*\s*100\}/g, '{PROGRESS_PERCENT}')
    processed = processed.replace(/\{([^}]+)\}/g, (match, expression) => {
      const trimmed = expression.trim()
      const randMatch = trimmed.match(
        /^RAND\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/
      )
      if (randMatch) {
        const lo = Math.ceil(Number(randMatch[1]))
        const hi = Math.floor(Number(randMatch[2]))
        return Math.floor(Math.random() * (hi - lo + 1)) + lo
      }
      if (variables.hasOwnProperty(trimmed)) {
        const value = variables[trimmed]
        if (typeof value === 'number') {
          if (
            [
              'INDEX',
              'TOTAL_POINTS',
              'MULTIPLIER',
              'BEEP',
              'POINT_NUMBER',
              'PROGRESS_PERCENT',
              'PCB_INDEX'
            ].includes(trimmed)
          ) {
            return value.toString()
          }
          return value.toFixed(2)
        }
        return value.toString()
      }
      try {
        const func = new Function(...Object.keys(variables), `return ${expression}`)
        const result = func(...Object.values(variables))
        if (typeof result === 'number') {
          if (expression.includes('Math.round') || Number.isInteger(result))
            return result.toString()
          return result.toFixed(2)
        }
        return result.toString()
      } catch {
        return match
      }
    })
    return processed
  }

  function setFeedOverride(percent) {
    setPrinter('feedOverride', Math.max(0, Math.min(200, percent)))
    serial.send(`M220 S${printer.value.feedOverride}`).catch(() => {})
  }

  async function sendManualCommand(command) {
    if (!printer.value.connected || !command.trim()) return
    await serial.send('M17 S0')
    await ensureAbsoluteMode()
    await serial.send(command.trim())
  }

  function onSent(callback) {
    sentCallbacks.value.push(callback)
    return () => {
      sentCallbacks.value = sentCallbacks.value.filter((cb) => cb !== callback)
    }
  }

  function fireSent(line) {
    for (const cb of sentCallbacks.value) {
      cb(line)
    }
  }

  return {
    printer: printer.value,
    jogStep,
    jogFeedXy,
    jogFeedZ,
    printLines,
    connect,
    disconnect,
    home,
    jogX,
    jogY,
    jogZ,
    moveTo,
    moveToPreset,
    emergencyStop,
    pausePrint,
    resumePrint,
    cancelPrint,
    startPrint,
    jogToPoint,
    solderPoint,
    setFeedOverride,
    sendManualCommand,
    parsePosition,
    onSent
  }
}
