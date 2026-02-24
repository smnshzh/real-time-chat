const { randomUUID } = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

const clients = new Set();
const typingUsers = new Set();

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcast(event, data) {
  for (const client of clients) {
    sendEvent(client, event, data);
  }
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function createMessage(user, text, type = 'user') {
  return { id: randomUUID(), user, text, sentAt: Date.now(), type };
}

function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(publicDir, filePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html';
    res.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    res.write(': connected\n\n');
    clients.add(res);

    req.on('close', () => {
      clients.delete(res);
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/message') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const user = String(payload.user || 'Guest').trim().slice(0, 24) || 'Guest';
        const text = String(payload.text || '').trim().slice(0, 1200);

        if (!text) {
          json(res, 400, { error: 'Message cannot be empty' });
          return;
        }

        broadcast('message', createMessage(user, text));
        json(res, 200, { ok: true });
      } catch {
        json(res, 400, { error: 'Invalid payload' });
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/typing') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const user = String(payload.user || 'Guest').trim().slice(0, 24) || 'Guest';
        const isTyping = Boolean(payload.isTyping);

        if (isTyping) typingUsers.add(user);
        else typingUsers.delete(user);

        broadcast('typing', { users: [...typingUsers] });
        json(res, 200, { ok: true });
      } catch {
        json(res, 400, { error: 'Invalid payload' });
      }
    });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
