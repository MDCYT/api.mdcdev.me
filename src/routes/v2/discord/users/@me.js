const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
    res.redirect(`/v1/users/${process.env.OWNER_DISCORD_ID}`);
});

module.exports = router;