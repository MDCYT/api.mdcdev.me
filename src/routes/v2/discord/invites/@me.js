const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
    res.redirect(`/v1/invites/${process.env.OWNER_DISCORD_SERVER_INVITE}`);
});

module.exports = router;