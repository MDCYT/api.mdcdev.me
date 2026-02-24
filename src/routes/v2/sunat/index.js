const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
  res.json({
    message: 'API de SUNAT',
    description: 'Consulta datos de RUC a partir del padrón de SUNAT.',
    endpoints: {
      'GET /ruc/:ruc': 'Obtiene información de un RUC',
    },
    examples: {
      'RUC': '/ruc/20100070970',
    },
  });
});

module.exports = router;
