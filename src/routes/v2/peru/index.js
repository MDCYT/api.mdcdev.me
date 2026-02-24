const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Módulo Perú - API de contenido de Perú',
    modules: {
      '/bomberos': 'APIs relacionadas con bomberos del Perú',
      '/indeci': 'APIs relacionadas con emergencias de INDECI',
    },
  });
});

module.exports = router;
