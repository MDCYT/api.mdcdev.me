const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
    res.redirect(`/v2/discord/applications/${process.env.OWNER_DISCORD_BOT_ID}`);
});

module.exports = router;