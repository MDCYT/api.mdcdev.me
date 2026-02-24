const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
  res.json({
    message: 'API de Discord',
    description: 'Obtén información pública de Discord (usuarios, guilds, invites y aplicaciones).',
    endpoints: {
      'GET /users/:id': 'Obtiene información de un usuario de Discord',
      'GET /guilds/:id': 'Obtiene información de un servidor (guild)',
      'GET /invites/:code': 'Obtiene información de un invite',
      'GET /applications/:id': 'Obtiene información de una aplicación',
    },
    examples: {
      'Usuario': '/users/1103388964485869609',
      'Servidor': '/guilds/949096817050648636',
      'Invite': '/invites/dae',
      'Aplicación': '/applications/1145470626178535625',
    },
  });
});

module.exports = router;
