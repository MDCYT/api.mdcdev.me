const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const axios = require('axios');

const RateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join(__basedir, 'utils', 'status-code-handler'));
const { Cache } = require(join(__basedir, 'utils', 'cache'));
const { responseHandler } = require(join(__basedir, 'utils', 'utils'));

const cache = new Cache("discord-rollouts", 4, 60 * 60 * 1)

const limit = RateLimit(1, 60);

router.get('/', limit, async (req, res) => {
    let data = await cache.get('rollouts');
    if (!data) await axios.get('https://experiments.dscrd.workers.dev/experiments').then(async response => {
        if (response.status === 200) {
            await cache.set('rollouts', response.data);
            data = response.data;
        } else {
            return statusCodeHandler({ statusCode: response.status }, res);
        }
    }).catch(err => {
        if (err) {
            console.log(err.stack);
            return statusCodeHandler({ statusCode: 503 }, res);
        }
        return null;
    }
    );

    if(!data) return statusCodeHandler({ statusCode: 503 }, res);

    return responseHandler(req.headers.accept, res, data, "experiments");

});

module.exports = router;