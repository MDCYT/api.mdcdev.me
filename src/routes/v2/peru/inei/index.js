const { Router } = require('express');
const router = Router();

// Subrutas
const criminalsRoutes = require('./criminals');

router.use('/criminals', criminalsRoutes);

router.get('/', (req, res) => {
  res.json({
    message: 'Módulo INEI - Instituto Nacional de Estadística e Informática',
    endpoints: {
      '/criminals': 'Puntos de criminales registrados',
      '/criminals/stats': 'Estadísticas de criminales',
      '/criminals/types': 'Tipos de delitos disponibles',
      '/criminals/heatmap': 'Datos para mapa de calor',
      '/criminals/by-location': 'Criminales filtrados por ubicación',
    },
  });
});

module.exports = router;
