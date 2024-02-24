const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const axios = require('axios');

const { getEspecificRollouts } = require(join(__basedir, 'utils', 'discord', 'rollouts'));
const RateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join(__basedir, 'utils', 'status-code-handler'));
const { Cache } = require(join(__basedir, 'utils', 'cache'));

const cache = new Cache("discord-users-rollouts", 4, 60 * 60 * 1)

const limit = RateLimit(1, 60);

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