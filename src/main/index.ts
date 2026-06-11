import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { SerialPort } from 'serialport'
import { setupOptimizerIPC } from './optimizer'

let selectedPortId: string | null = null

// Disable Chromium's serial port blocklist so all USB-to-serial adapters are visible
app.commandLine.appendSwitch('disable-serial-blocklist')

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  const mainWindow = createWindow()

  // Setup optimizer IPC handlers
  setupOptimizerIPC(mainWindow)

  // IPC: List available serial ports for the custom port picker
  ipcMain.handle('serial:get-ports', async () => {
    try {
      const ports = await SerialPort.list()
      return ports.map((p) => ({
        portId: p.path,
        portName: p.path,
        displayName: p.manufacturer || p.path
      }))
    } catch (err) {
      console.error('Failed to list serial ports:', err)
      return []
    }
  })

  // IPC: Set the user's port selection so the select-serial-port handler auto-selects it
  ipcMain.on('serial:select-port', (_event, portId: string) => {
    selectedPortId = portId
  })

  // Web Serial API: auto-select port when navigator.serial.requestPort() is called
  mainWindow.webContents.session.on(
    'select-serial-port',
    (event, portList, _webContents, callback) => {
      event.preventDefault()

      if (!portList || portList.length === 0) {
        dialog.showErrorBox(
          'No Serial Ports Found',
          'No serial devices were detected. Make sure your device is plugged in and drivers are installed.'
        )
        callback('')
        return
      }

      // If the renderer pre-selected a port via the custom picker, match by portName
      if (selectedPortId) {
        const match = portList.find(
          (p) => p.portName === selectedPortId || p.portId === selectedPortId
        )
        if (match) {
          callback(match.portId)
          selectedPortId = null
          return
        }
      }

      // Fallback: auto-select the first port
      callback(portList[0].portId)
    }
  )
  mainWindow.webContents.session.setPermissionCheckHandler(
    (_webContents, permission, _requestingOrigin, details) => {
      if (permission === 'serial' && (details.securityOrigin === 'file:///' || details.securityOrigin.startsWith('http://localhost'))) {
        return true
      }
      return false
    }
  )

  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'serial' && (details.origin === 'file://' || details.origin.startsWith('http://localhost'))) {
      return true
    }
    return false
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
