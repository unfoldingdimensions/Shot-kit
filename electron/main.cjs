const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
}

let mainWindow = null
let localServer = null

function createStaticServer() {
  const root = path.join(__dirname, '..', 'out')

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, 'http://localhost')
      let pathname = decodeURIComponent(parsedUrl.pathname)

      if (pathname === '/') {
        pathname = '/index.html'
      }

      let filePath = path.join(root, pathname)

      if (!fs.existsSync(filePath) || fs.statSync(filePath, { throwIfNoEntry: false })?.isDirectory()) {
        if (fs.existsSync(filePath + '.html')) {
          filePath = filePath + '.html'
        } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
          filePath = path.join(filePath, 'index.html')
        } else {
          filePath = path.join(root, '404.html')
        }
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('404 Not Found')
          return
        }

        const ext = path.extname(filePath).toLowerCase()
        const contentType = MIME_TYPES[ext] || 'application/octet-stream'
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
        })
        res.end(data)
      })
    })

    // Listen on random available port on localhost only
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      resolve({ server, port })
    })
  })
}

async function createWindow() {
  const { server, port } = await createStaticServer()
  localServer = server

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Shotkit',
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  // Remove default menu for sleek app look
  Menu.setApplicationMenu(null)

  // Open target URL
  await mainWindow.loadURL(`http://127.0.0.1:${port}`)

  // Open external links in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      return { action: 'allow' }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (localServer) {
    localServer.close()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
