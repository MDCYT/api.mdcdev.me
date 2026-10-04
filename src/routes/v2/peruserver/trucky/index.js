const { Router } = require('express');

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Math.floor(Date.now() / 1000),
  });
});

router.get('/', (req, res) => {
  res.json({
    message: 'Modulo Trucky de PeruServer',
    modules: {
      '/webhook': 'Webhook interno para registrar trabajos de Trucky',
      '/live-jobs': 'Trabajos en vivo y datos geograficos cacheados',
      '/top-km': 'Top de kilometros por empresa acumulado',
      '/top-km/monthly': 'Top mensual de kilometros por empresa',
      '/public': 'API publica para empresas, ranking de usuarios y rutas',
      '/health': 'Estado del servicio',
    },
  });
});

module.exports = router;
