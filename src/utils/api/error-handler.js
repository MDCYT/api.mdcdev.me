const { Router } = require('express');
const router = Router();

const { statusCodeHandler } = require(`../status-code-handler`);

router.all('*', (req, res, next) => {
    try {
        next();
    } catch (error) {
        console.error(error);
        return statusCodeHandler({ statusCode: 500 }, res);
    }
})

module.exports = router;