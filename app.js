const express = require('express');
const app = express();

// Ensure Express trusts the reverse proxy (e.g. nginx, Vercel, Heroku).
// This allows req.ip to reflect the client's IP from X-Forwarded-For.
app.set('trust proxy', true);

module.exports = app;
