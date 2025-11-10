const express = require('express');
const router = express.Router();
const getClientIp = require('../lib/getClientIp');

// Example: in the request-recording handler (adjust to your actual handler)
router.post('/record', function (req, res, next) {
  // ...existing code...

  // Replace previous IP extraction (e.g. req.ip or req.connection.remoteAddress)
  const clientIp = getClientIp(req);

  // ...existing code that builds the record...
  const record = {
    // ...other fields...
    ip: clientIp,
    timestamp: new Date().toISOString()
  };

  // store the record (your existing store call)
  // store.save(record)  <-- keep your actual storage call
  // ...existing code...
  res.json({ ok: true });
});
// ...existing code...
