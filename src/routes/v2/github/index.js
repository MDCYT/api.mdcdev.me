const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
  res.json({
    message: 'API de GitHub',
    description: 'Obtén información pública de GitHub (usuarios y repositorios).',
    endpoints: {
      'GET /users/:username': 'Obtiene información de un usuario',
      'GET /repositories/:username/:repository': 'Obtiene información de un repositorio',
    },
    examples: {
      'Usuario': '/users/mdcyt',
      'Repositorio': '/repositories/mdcyt/api.mdcdev.me',
    },
  });
});

module.exports = router;
