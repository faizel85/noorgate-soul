#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3202;
const BASE_DIR = __dirname;

const server = http.createServer((req, res) => {
  // Parse the requested path
  const parsedUrl = url.parse(req.url, true);
  let pathname = decodeURI(parsedUrl.pathname);

  // Default to index.html if root
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // Construct file path
  const filePath = path.join(BASE_DIR, pathname);

  // Security: prevent path traversal
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Serve the file
  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found: ' + pathname);
      return;
    }

    // Determine content type
    let contentType = 'text/plain';
    if (filePath.endsWith('.html')) {
      contentType = 'text/html; charset=utf-8';
    } else if (filePath.endsWith('.md')) {
      contentType = 'text/markdown; charset=utf-8';
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, 'localhost', () => {
  console.log(`SOUL server listening on http://localhost:${PORT}`);
  console.log(`Serving files from: ${BASE_DIR}`);
});
