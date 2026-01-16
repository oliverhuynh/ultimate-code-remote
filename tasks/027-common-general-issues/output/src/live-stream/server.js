const fs = require('fs');
const sessionStore = require('../utils/session-store');
const { validateLiveSecret, getEventsPath } = require('../utils/live-stream');

function attachLiveStreamRoutes(app) {
    app.get('/tokens/:token/live', (req, res) => {
        const token = req.params.token;
        const secret = req.query.pw;

        if (!token || !secret || !validateLiveSecret(token, secret)) {
            res.status(403).send(renderExpiredPage());
            return;
        }

        const session = sessionStore.findSessionByToken(token);
        if (!session) {
            res.status(403).send(renderExpiredPage());
            return;
        }

        const eventsPath = getEventsPath(session.id);

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        });
        if (typeof res.flushHeaders === 'function') {
            res.flushHeaders();
        }

        let position = 0;
        if (fs.existsSync(eventsPath)) {
            const initial = fs.readFileSync(eventsPath, 'utf8');
            position = Buffer.byteLength(initial);
            initial.split('\n').filter(Boolean).forEach((line) => {
                res.write(`data: ${line}\n\n`);
            });
        }

        const interval = setInterval(() => {
            if (!fs.existsSync(eventsPath)) return;
            const stats = fs.statSync(eventsPath);
            if (stats.size <= position) return;
            const fd = fs.openSync(eventsPath, 'r');
            const buffer = Buffer.alloc(stats.size - position);
            fs.readSync(fd, buffer, 0, buffer.length, position);
            fs.closeSync(fd);
            position = stats.size;
            buffer.toString().split('\n').filter(Boolean).forEach((line) => {
                res.write(`data: ${line}\n\n`);
            });
        }, 1000);

        const heartbeat = setInterval(() => {
            res.write(': ping\n\n');
        }, 15000);

        req.on('close', () => {
            clearInterval(interval);
            clearInterval(heartbeat);
        });
    });

    app.get('/tokens/:token/live/view', (req, res) => {
        const token = req.params.token;
        const secret = req.query.pw || '';
        if (!token || !secret || !validateLiveSecret(token, secret)) {
            res.status(403).send(renderExpiredPage());
            return;
        }
        const session = sessionStore.findSessionByToken(token);
        if (!session) {
            res.status(403).send(renderExpiredPage());
            return;
        }
        res.send(renderLivePage(token, secret));
    });
}

function renderExpiredPage() {
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Live link expired</title></head>
<body style="font-family: sans-serif; padding: 24px;">
<h2>Live link expired</h2>
<p>Ask again with <code>/live &lt;TOKEN&gt;</code> to generate a new link.</p>
</body></html>`;
}

function renderLivePage(token, secret) {
    const sseUrl = `/tokens/${token}/live?pw=${encodeURIComponent(secret)}`;
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Live Stream</title>
<style>
body { font-family: sans-serif; margin: 0; padding: 16px; background: #f7f8fa; }
#status { font-weight: bold; margin-bottom: 12px; }
#token { color: #5b5b5b; font-size: 12px; margin-bottom: 16px; }
.event { background: #fff; border: 1px solid #e3e6ea; border-radius: 8px; margin: 10px 0; padding: 10px 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.event-header { font-size: 12px; color: #56606b; margin-bottom: 6px; text-transform: capitalize; }
.event pre { margin: 0; background: #f3f5f7; padding: 8px; border-radius: 6px; white-space: pre-wrap; }
</style>
</head>
<body>
<div id="status">● Live</div>
<div id="token">Token: ${token}</div>
<div id="feed"></div>
<script>
const feed = document.getElementById('feed');
const statusEl = document.getElementById('status');
function formatLabel(data) {
  const type = data && data.type ? String(data.type).replace(/_/g, ' ') : 'event';
  const time = data && data.ts ? new Date(data.ts).toLocaleString() : '';
  return time ? type + ' · ' + time : type;
}
function addEvent(data) {
  const div = document.createElement('div');
  div.className = 'event';
  const header = document.createElement('div');
  header.className = 'event-header';
  header.textContent = formatLabel(data);
  const body = document.createElement('pre');
  if (data && typeof data === 'object') {
    body.textContent = data.text || JSON.stringify(data);
  } else {
    body.textContent = String(data || '');
  }
  div.appendChild(header);
  div.appendChild(body);
  feed.appendChild(div);
}
function connect() {
  statusEl.textContent = '● Live';
  statusEl.style.color = 'green';
  const evt = new EventSource('${sseUrl}');
  evt.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      addEvent(data);
    } catch (err) {
      addEvent({ text: e.data });
    }
  };
  evt.onerror = () => {
    statusEl.textContent = '● Reconnecting';
    statusEl.style.color = 'gray';
    evt.close();
    setTimeout(connect, 3000);
  };
}
connect();
</script>
</body></html>`;
}

module.exports = {
    attachLiveStreamRoutes
};
