const { Router } = require('express');

const router = Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Modulo Trucky de PeruServer',
    modules: {
      '/webhook': 'Webhook interno para registrar trabajos de Trucky',
      '/live-jobs': 'Trabajos en vivo y datos geograficos cacheados',
      '/top-km': 'Top de kilometros por empresa',
      '/top-km/monthly': 'Top mensual de kilometros por empresa',
      '/public': 'API publica para empresas, top de usuarios y rutas por empresa',
    },
  });
});

module.exports = router;
