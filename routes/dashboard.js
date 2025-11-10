const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
	// Get tracker data from app.locals (set elsewhere) or default to empty object
	const tracker = req.app.locals.tracker || {};
	res.render('index', { tracker });
});

module.exports = router;
