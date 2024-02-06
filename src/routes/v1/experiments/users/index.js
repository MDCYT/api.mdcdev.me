const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const rateLimit = require('express-rate-limit')
const axios = require('axios');

const { getEspecificRollouts } = require(join(__basedir, 'utils', 'discord', 'rollouts'));
const RedisRateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join(__basedir, 'utils', 'status-code-handler'));
const { Cache } = require(join(__basedir, 'utils', 'cache'));

const cache = new Cache("users-rollouts", 4, 60 * 60 * 1)

const limit = rateLimit({
    windowMs: 1000 * 60 * 1, // 1 minute window
    max: (req, res) => {
        return 60;
    }, // start blocking after 60 requests
    message: (req, res) => {
        statusCodeHandler({ statusCode: 10001 }, res);
    },
    skip: (req, res) => {
        //If the request is from me, skip the rate limit
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        if (ip === 'localhost' || ip === '::1') {
            return true;
        }
        return false;
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    store: RedisRateLimit
})

router.get('/', limit, async (req, res) => {
    let data = await cache.get('guild-rollouts');
    if (!data) await axios.get(req.protocol + '://' + req.get('host') + `/v1/experiments`).then(async response => {
        if (response.status === 200) {
            await cache.set('rollouts', response.data);
            data = response.data;
        } else {
            return statusCodeHandler({ statusCode: response.status }, res);
        }
    }).catch(err => {
        return;
    }
    );

    if(!data) return statusCodeHandler({ statusCode: 503 }, res);

    return res.json(getEspecificRollouts(data, "user"));

});

module.exports = router;