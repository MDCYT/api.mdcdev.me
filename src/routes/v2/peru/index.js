const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Módulo Perú - API de contenido de Perú',
    modules: {
      '/bomberos': 'APIs relacionadas con bomberos del Perú',
      '/indeci': 'APIs relacionadas con emergencias de INDECI',
      '/igp': 'APIs relacionadas con sismos del IGP',
      '/cameras': 'Lista de cámaras y streams proxy',
      '/inei': 'APIs relacionadas con datos del INEI (delitos, estadísticas)',
    },
  });
});

module.exports = router;
