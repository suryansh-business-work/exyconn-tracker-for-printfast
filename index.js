const express = require('express');
const path = require('path');
const fs = require('fs');
const exphbs = require('express-handlebars');

const app = express();
const PORT = process.env.PORT || 4003;
const STORAGE_FILE = path.join(__dirname, 'storage', 'ae2aeb935c2a8c7a80fb116093ef35ca');

// Lightweight CORS handling: allow configurable origin via env var, default to '*'
const CORS_ALLOW_ORIGIN = process.env.CORS_ALLOW_ORIGIN || '*';
app.use((req, res, next) => {
  // Allow origin (configurable)
  res.setHeader('Access-Control-Allow-Origin', CORS_ALLOW_ORIGIN);

  // Allow all common HTTP methods
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');

  // If the browser sends a preflight request specifying desired headers, echo them back
  // This effectively allows arbitrary request headers the client asks for.
  const requestedHeaders = req.headers['access-control-request-headers'];
  if (requestedHeaders) {
    res.setHeader('Access-Control-Allow-Headers', requestedHeaders);
  } else {
    // Fallback safe set
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
  }

  // Only set credentials when a specific origin is configured (not '*')
  if (CORS_ALLOW_ORIGIN !== '*') res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Cache preflight for 24 hours
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Register Handlebars
const hbs = exphbs.create({ defaultLayout: 'main' });
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// static assets (optional)
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint 1: pixel tracker that increments and returns 1x1 image
app.get('/pixel', async (req, res) => {
  try {
    // get IP (respecting X-Forwarded-For if present)
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();

    // read and parse storage file (safe fallback)
    let raw = null;
    try {
      raw = await fs.promises.readFile(STORAGE_FILE, 'utf8');
    } catch (readErr) {
      // file may not exist yet — we'll create it below
      raw = null;
    }

    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch (parseErr) {
      // invalid JSON; treat as empty tracker
      parsed = null;
    }

    // The storage file might be wrapped as { key, value }
    let tracker = (parsed && parsed.value) ? parsed.value : parsed;
    tracker = tracker || { count: 0, requests: [] };

    // increment count and create record
    tracker.count = (tracker.count || 0) + 1;
    const record = {
      id: tracker.count,
      timestamp: new Date().toISOString(),
      ip,
      count: tracker.count
    };

    // push record
    tracker.requests = tracker.requests || [];
    tracker.requests.push(record);

    // prepare output JSON, preserving wrapper shape if present
    let outJson;
    if (parsed && parsed.value) {
      parsed.value = tracker;
      outJson = JSON.stringify(parsed, null, 2);
    } else {
      outJson = JSON.stringify(tracker, null, 2);
    }

    // ensure storage dir exists and write file
    await fs.promises.mkdir(path.dirname(STORAGE_FILE), { recursive: true });
    await fs.promises.writeFile(STORAGE_FILE, outJson, 'utf8');

    // 1x1 PNG (transparent) as base64 -> buffer
    const PX_BUFFER = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
      'base64'
    );

    // respond with PNG
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': PX_BUFFER.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.send(PX_BUFFER);
  } catch (err) {
    console.error('pixel endpoint error:', err);
    res.status(500).send('error');
  }
});

// Add: require the dashboard router
const dashboardRouter = require('./routes/dashboard');

// Home route: read storage and render index.handlebars
app.get('/', (req, res) => {
  fs.readFile(STORAGE_FILE, 'utf8', (err, raw) => {
    if (err) {
      console.error('Failed to read storage file', err);
      return res.status(500).send('Failed to read storage');
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('Invalid JSON in storage file', e);
      return res.status(500).send('Invalid storage JSON');
    }
    // The storage file uses shape: { "key": "tracker", "value": { count: ..., requests: [...] } }
    const tracker = (parsed && parsed.value) ? parsed.value : parsed;

    // compute summary metrics
    const requests = (tracker && Array.isArray(tracker.requests)) ? tracker.requests : [];
    const totalHits = (tracker && typeof tracker.count === 'number') ? tracker.count : requests.length;
    const uniqueIPs = new Set(requests.map(r => r && r.ip).filter(Boolean)).size;

    res.render('index', { tracker, summary: { totalHits, uniqueIPs } });
  });
});

// simple API endpoint to return raw JSON (optional)
app.get('/api/tracker', (req, res) => {
  fs.readFile(STORAGE_FILE, 'utf8', (err, raw) => {
    if (err) return res.status(500).json({ error: 'read error' });
    try { return res.json(JSON.parse(raw)); }
    catch (e) { return res.status(500).json({ error: 'invalid json' }); }
  });
});

// Mount the dashboard router so /dashboard loads the index.handlebars
app.use('/dashboard', dashboardRouter);

// Add: POST endpoint to delete / reset all stored tracker data
app.post('/dashboard/delete', async (req, res) => {
  try {
    // read existing storage (if any)
    let raw = null;
    try {
      raw = await fs.promises.readFile(STORAGE_FILE, 'utf8');
    } catch (readErr) {
      // file may not exist yet — treat as missing
      raw = null;
    }

    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch (parseErr) {
      // invalid JSON; we'll overwrite with default
      parsed = null;
    }

    const defaultTracker = { count: 0, requests: [] };
    let outJson;
    if (parsed && parsed.value) {
      parsed.value = defaultTracker;
      outJson = JSON.stringify(parsed, null, 2);
    } else {
      outJson = JSON.stringify(defaultTracker, null, 2);
    }

    // ensure storage dir exists and write file
    await fs.promises.mkdir(path.dirname(STORAGE_FILE), { recursive: true });
    await fs.promises.writeFile(STORAGE_FILE, outJson, 'utf8');

    // redirect back to referring page or home
    const referer = req.get('Referer') || '/';
    return res.redirect(referer);
  } catch (err) {
    console.error('Failed to reset tracker storage:', err);
    return res.status(500).send('Failed to delete data');
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
