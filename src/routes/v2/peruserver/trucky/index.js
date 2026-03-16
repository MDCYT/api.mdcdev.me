// Index para rutas de trucky en peruserver
const express = require('express');
const router = express.Router();

// Importar la nueva ruta webhook
router.use('/webhook', require('./webhook'));

// ...otras rutas existentes...

module.exports = router;
