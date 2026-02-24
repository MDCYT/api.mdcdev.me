const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
  res.json({
    message: 'API de Toyhouse',
    description: 'Obtén información pública de usuarios de Toyhouse.',
    endpoints: {
      'GET /users/:username': 'Obtiene información de un usuario',
    },
    examples: {
      'Usuario': '/users/mdcyt',
    },
  });
});

module.exports = router;
