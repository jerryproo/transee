const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, dialog } = require('electron')
const electron = require('electron')
const path = require('path')
const events = require('events')
const settings = require('electron-settings')
const updater = require('./updater')

const appVersion = app.getVersion()
const indexPath = `file://${__dirname}/../renderer/index.html`
const preferencesPath = `file://${__dirname}/../renderer/preferences.html`
const aboutPath = `file://${__dirname}/../renderer/about.html#v${appVersion}`
const welcomePath = `file://${__dirname}/../renderer/welcome.html`
const iconPath = process.platform === 'win32' ?
  path.join(__dirname, '../assets', 'icon_16x16.ico') :
  path.join(__dirname, '../assets', 'iconTemplate.png')

var win, aboutWin, tray, preferencesWin, welcomeWin, globalY, accelerator

app.on('ready', appReady)

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

process.on('uncaughtException', () => {
  console.log('uncaughtException')
})

function appReady() {

  let check = app.getLoginItemSettings().openAtLogin
  settings.set('start-login', check)

  let screen = electron.screen
  let screenHeight = screen.getPrimaryDisplay().size.height
  globalY = screenHeight > 800 ? 160 : 80

  // HANDLE APP VERSION
  let versionInSettings = settings.get('version')
  if (appVersion !== versionInSettings) {
    settings.set('version', appVersion)
    settings.set('show-welcome', true)
  }

  // SET GLOBAL SHORTCUT
  if (settings.has('shortcut')) {
    accelerator = settings.get('shortcut')
  } else {
    accelerator = 'Ctrl+Alt+T'
    settings.set('shortcut', accelerator)
  }
  if (accelerator) {
    const ret = globalShortcut.register(accelerator, () => { showWindow() })
  }

  // CREATE TRAY AND CONTEXT MENU
  tray = new Tray(iconPath)

  const contextMenu = Menu.buildFromTemplate([
    { label: 'About Transee', click: () => showAboutWindow() },
    { label: 'Check for update', click: () => updater.checkForUpdates(true) },
    { type: 'separator' },
    { label: 'Preferences...', click: () => showPreferencesWindow() },
    { type: 'separator' },
    { label: 'Show translation bar', accelerator: accelerator, click: () => showWindow() },
    { type: 'separator' },
    { label: 'Welcome Guide', click: () => showWelcomeWindow()},
    { type: 'separator' },
    { label: 'Quit', accelerator: 'Command+Q', click: () => app.quit() }
  ])

  tray.setContextMenu(contextMenu)

  // AUTOMATICALLY UPDATES
  let checkAutomaticallyUpdates = settings.has('check-automatically-updates') ?
    settings.get('check-automatically-updates') : true

  if (checkAutomaticallyUpdates) {
    setTimeout(() => updater.checkForUpdates(false), 1000 * 60 * 3)
  }

  // SHOW WELCOME GUIDE
  let showWelcome = settings.has('show-welcome') ? settings.get('show-welcome') : true
  if (showWelcome) createWelcomeWindow()

  // HIDE DOCK ICON IN MACOS
  if (process.platform === 'darwin' && !showWelcome) app.dock.hide()
}

const createWindow = () => {
  win = new BrowserWindow({
    width: 680,
    height: 85,
    frame: false,
    // vibrancy: 'ultra-dark',
    fullscreenable: false,
    resizable: false,
    transparent: true
  })

  win.on('blur', () => {
    hideWindow()
  })

  win.setVisibleOnAllWorkspaces(true)
  win.loadURL(indexPath)
  win.on('close', () => {
    win = null
  })

  win.webContents.on('crashed', () => { })
  win.on('unresponsive', () => { })

  const template = [
    {
      label: 'Edit',
      submenu: [
        {role: 'undo'},
        {role: 'redo'},
        {type: 'separator'},
        {role: 'cut'},
        {role: 'copy'},
        {role: 'paste'},
        {role: 'pasteandmatchstyle'},
        {role: 'delete'},
        {role: 'selectall'}
      ]
    }
  ]

  const menu = process.platform === 'darwin' ? Menu.buildFromTemplate(template) : null
  Menu.setApplicationMenu(menu)
}

const createAboutWindow = () => {
  aboutWin = new BrowserWindow({
    width: 520,
    height: 250,
    titleBarStyle: 'hidden',
    // vibrancy: 'ultra-dark',
    minimizable: false,
    maximizable: false,
    resizable: false
  })

  aboutWin.loadURL(aboutPath)

  aboutWin.on('close', () => {
    aboutWin = null
  })
}

const createPreferencesWindow = () => {
  preferencesWin = new BrowserWindow({
    width: 420,
    height: 430,
    titleBarStyle: 'hidden',
    // vibrancy: 'ultra-dark'
    minimizable: false,
    maximizable: false,
    resizable: false
  })

  preferencesWin.loadURL(preferencesPath)

  preferencesWin.on('close', () => {
    preferencesWin = null
  })
}

const createWelcomeWindow = () => {
  welcomeWin = new BrowserWindow({
    width: 520,
    height: 430,
    titleBarStyle: 'hidden',
    minimizable: false,
    maximizable: false,
    resizable: false
  })

  welcomeWin.loadURL(welcomePath)

  welcomeWin.on('close', () => {
    welcomeWin = null
    app.dock.hide()
  })
}

function showWindow() {
  if (!win) {
    createWindow()
  }

  var { x, y } = getWindowPosition()
  win.setPosition(x, y)
  win.show()
}

function hideWindow() {
  if (win) win.hide()
}

function getWindowPosition() {
  let screen = electron.screen
  let point = screen.getCursorScreenPoint()
  let displayBounds = screen.getDisplayNearestPoint(point).bounds
  let windowBounds = win.getBounds()

  const x = Math.round(displayBounds.x + (displayBounds.width - windowBounds.width) / 2)
  const y = globalY

  return { x, y }
}

function showAboutWindow() {
  if (!aboutWin) {
    createAboutWindow()
  }
}

function showWelcomeWindow() {
  if (!welcomeWin) {
    createWelcomeWindow()
  }
}

function showPreferencesWindow() {
  if (!preferencesWin) {
    createPreferencesWindow()
  }
}

ipcMain.on('window-height', (event, height) => {
  win.setSize(680, height)
  event.returnValue = true
})

ipcMain.on('hide-window', (event, msg) => {
  hideWindow()
})

ipcMain.on('set-start-login', (event, check) => {
  app.setLoginItemSettings({
    openAtLogin: check
  })
})

ipcMain.on('change-shortcut', (event, shortcut) => {
  globalShortcut.unregisterAll()
  globalShortcut.register(shortcut, () => { showWindow() })
})

ipcMain.on('set-transparency', (event, check) => {
  win.webContents.send('set-transparency', check)
})

ipcMain.on('delete-shortcut', (event) => {
  globalShortcut.unregisterAll()
  settings.set('shortcut', '')
})
