const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  nativeImage,
  Notification,
  electron
} = require('electron')
const settings = require('electron-settings')
const path = require('path')
const AutoLaunch = require('auto-launch')
const batteryLevel = require('battery-level')

const al = new AutoLaunch({
  name: 'Volta'
})
const defaultValues = {
  min: 50,
  max: 85
}
const maxNotifications = 3

let tray = undefined
let window = undefined

let lastBattery = undefined
let charging = undefined
let numMin = 0
let numMax = 0

if (app.dock !== undefined) app.dock.hide()

app.on('ready', () => {
  createTray()
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

const createTray = () => {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'battery.png')).resize({
    width: 24,
    height: 24
  })
  tray = new Tray(icon)
  tray.on('right-click', toggleWindow)
  tray.on('double-click', toggleWindow)
  tray.on('click', toggleWindow)
}

const getWindowPosition = () => {
  const windowBounds = window.getBounds()
  const trayBounds = tray.getBounds()

  const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2))
  const y = Math.round(trayBounds.y + trayBounds.height + 4)

  return {
    x,
    y
  }
}

const createWindow = () => {
  window = new BrowserWindow({
    width: 300,
    height: 400,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    transparent: true
  })
  window.loadURL(`file://${path.join(__dirname, 'index.html')}`)

  window.on('blur', () => {
    if (!window.webContents.isDevToolsOpened()) window.hide()
  })

  window.webContents.on('did-finish-load', sendCurrentValues)

  // window.openDevTools({
  //   mode: 'detach'
  // })
}

const toggleWindow = () => {
  if (window.isVisible()) {
    window.hide()
  } else {
    showWindow()
  }
}

const showWindow = () => {
  const position = getWindowPosition()
  window.setPosition(position.x, position.y, false)
  window.show()
  window.focus()
}

const sendCurrentValues = () => {
  window.webContents.send('values', settings.get('values', defaultValues))
  window.webContents.send('launch', settings.get('launch', false))
}

ipcMain.on('quit', () => {
  app.quit()
})
ipcMain.on('values', (event, arg) => settings.set('values', arg))
ipcMain.on('launch', (event, arg) => {
  settings.set('launch', arg)
  if (arg) al.enable()
  else al.disable()
})

function sendMin() {
  if (++numMin > maxNotifications || charging) return
  new Notification({
    name: 'Volta',
    body: `🔌 Plug in`
  }).show()
}

function sendMax() {
  if (++numMax > maxNotifications || !charging) return
  new Notification({
    name: 'Volta',
    body: `🔋 Unplug`,
  }).show()
}

setInterval(() => {
  batteryLevel().then(level => {
    level = parseInt(level * 100)

    if (level === lastBattery) return
    if (level > lastBattery) charging = true
    else charging = false
    lastBattery = level

    const limits = settings.get('values', defaultValues)

    if (level <= limits.min) sendMin()
    else if (level >= limits.max) sendMax()
    else numMax = numMin = 0

    window.webContents.send('battery', level)
  }).catch(() => console.log('Could not get Battery level'))
}, 3000)