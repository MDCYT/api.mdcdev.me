const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
  res.json({
    message: 'API de INDECI Perú',
    description: 'Obtén información sobre emergencias reportadas por INDECI',
    endpoints: {
      'GET /incidentes': 'Obtiene incidentes (default: últimas 24 horas). Parámetros: rango=horas|dias, cantidad=N',
      'GET /incidentes/distrito/:distrito': 'Obtiene incidentes por distrito',
      'GET /incidentes/status': 'Estado de las actualizaciones automáticas',
    },
    examples: {
      'Últimas 24 horas': '/incidentes',
      'Últimas 48 horas': '/incidentes?rango=horas&cantidad=48',
      'Últimos 7 días': '/incidentes?rango=dias&cantidad=7',
      'Últimos 30 días': '/incidentes?rango=dias&cantidad=30',
      'Distrito de Lima': '/incidentes/distrito/Lima',
    },
  });
});

module.exports = router;
