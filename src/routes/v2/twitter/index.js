const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
  res.json({
    message: 'API de Twitter',
    description: 'Obtén información pública de Twitter (usuarios y tweets).',
    endpoints: {
      'GET /users/:username': 'Obtiene información de un usuario',
      'GET /tweets/:id': 'Obtiene información de un tweet',
    },
    examples: {
      'Usuario': '/users/mdc_dev',
      'Tweet': '/tweets/1756031350723821514',
    },
  });
});

module.exports = router;
