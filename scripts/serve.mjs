import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', 'out')

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

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  let pathname = decodeURIComponent(parsedUrl.pathname)

  if (pathname === '/') {
    pathname = '/index.html'
  }

  let filePath = path.join(ROOT, pathname)

  // If path doesn't have an extension, try .html or /index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath, { throwIfNoEntry: false })?.isDirectory()) {
    if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html'
    } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html')
    } else {
      filePath = path.join(ROOT, '404.html')
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

const DEFAULT_PORT = 3333

server.listen(DEFAULT_PORT, () => {
  const address = server.address()
  const port = address.port
  const url = `http://localhost:${port}`
  console.log(`\n========================================`)
  console.log(`  Shotkit is running at: ${url}`)
  console.log(`========================================\n`)

  const appMode = process.argv.includes('--app')
  const openBrowser = !process.argv.includes('--no-open')

  if (openBrowser) {
    if (appMode && process.platform === 'win32') {
      // Try launching Microsoft Edge in standalone App Mode
      const edge = spawn('cmd', ['/c', 'start', 'msedge', `--app=${url}`, '--window-size=1440,900'], {
        detached: true,
        stdio: 'ignore',
      })
      edge.unref()
    } else {
      // Standard browser launch
      const opener = process.platform === 'win32'
        ? spawn('cmd', ['/c', 'start', url], { detached: true, stdio: 'ignore' })
        : process.platform === 'darwin'
        ? spawn('open', [url], { detached: true, stdio: 'ignore' })
        : spawn('xdg-open', [url], { detached: true, stdio: 'ignore' })
      opener.unref()
    }
  }
})
