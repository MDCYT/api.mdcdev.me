const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const rateLimit = require('express-rate-limit')
const axios = require('axios');

const HTTP = require(join(__basedir, 'utils', 'discord', 'HTTP'));
const { Image } = require(join(__basedir, 'utils', 'discord', 'images'));
const { ApplicationFlags } = require(join(__basedir, 'utils', 'discord', 'flags'));
const RedisRateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join(__basedir, 'utils', 'status-code-handler'));
const { Cache } = require(join(__basedir, 'utils', 'cache'));
const { responseHandler } = require(join(__basedir, 'utils', 'utils'));

const cache = new Cache("discord-applications", 1, 60 * 60 * 24)

const limit = rateLimit({
    windowMs: 1000 * 60 * 15, // 15 minutes window
    max: (req, res) => {
        return 25;
    }, // start blocking after 25 requests
    message: (req, res) => {
        statusCodeHandler({ statusCode: 10001 }, res);
    },
    skip: (req, res) => {
        //If the :id is process.env.OWNER_DISCORD_BOT_ID, skip the rate limit
        if (req.params.id === process.env.OWNER_DISCORD_BOT_ID) return true;

        //If the request is from me, skip the rate limit
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        if (ip === 'localhost' || ip === '::1' || ip === '::ffff:127.0.0.1') {
            return true;
        }

        return false;
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    store: RedisRateLimit
})

router.get('/:id', limit, async (req, res) => {
    const { id } = req.params;
    const http = new HTTP(process.env.DISCORD_BOT_TOKEN);
    let data = await cache.get(id);
    if (!data) await http.get('APPLICATION_URL', "path", id).then(async response => {
        //If the response is 200, add the user to the cache
        if (response.status === 200) {
            await cache.set(id, response.data);
            data = response.data;
        } else {
            return statusCodeHandler({ statusCode: response.status }, res);
        }
    }).catch(err => {
        return statusCodeHandler({ statusCode: 14001 }, res);
    });
    if (!data) return statusCodeHandler({ statusCode: 14001 }, res);


    //If the application has a cover image, add it to the object
    if (data.cover_image) {
        data.coverImageURL = new Image("ApplicationCover", data.id, data.cover_image).url;
        data.coverImageURLs = new Image("ApplicationCover", data.id, data.cover_image).sizes;
    }

    //If the application has a icon, add it to the object
    if (data.icon) {
        data.iconURL = new Image("ApplicationIcon", data.id, data.icon).url;
        data.iconURLs = new Image("ApplicationIcon", data.id, data.icon).sizes;
    }

    if (data.team) {
        if (data.team.icon) {
            data.team.iconURL = Image("TeamIcon", data.team.id, data.team.icon).url;
            data.team.iconURLs = Image("TeamIcon", data.team.id, data.team.icon).sizes;
        }

        data.team.members.forEach(async member => {

            //Get a axios get request to the user
            let response = await axios.get(req.protocol + '://' + req.get('host') + `/v1/users/${member.user.id}`);
            //If the response is 200, replace the user object with the response data
            if (response.status === 200) {
                member.user = response.data;
            }
        });

        //Sort the team members by their membershipState
        data.team.members = data.team.members.sort((a, b) => {
            return a.membershipState - b.membershipState;
        });
    }

    //If the application has a owner, add it to the object
    if (data.owner) {
        //Get a axios get request to the user
        let response = await axios.get(req.protocol + '://' + req.get('host') + `/v1/users/${data.owner.id}`);
        //If the response is 200, replace the user object with the response data
        if (response.status === 200) {
            data.owner = response.data;
        }
    }

    //Get the application's flags
    data.publicFlags = data.flags;
    let flags = new ApplicationFlags(data.publicFlags);
    data.flags = flags.getFlags();    

    //If have id, get the user from api
    if (data.id) {
        //Get a axios get request to the user
        try {
            await axios.get(req.protocol + '://' + req.get('host') + `/v1/users/${data.id}`).then((response) => {
                //If the response is 200, replace the user object with the response data
                if (response.status === 200) {
                    data.user = response.data;
                }
            }).catch((_e) => {
            });
        } catch (_e) {
        }
        let date = new Date(parseInt(data.id) / 4194304 + 1420070400000);

        //Get the createdAt, createdAtTimestamp by Discord Snowflake
        data.createdAt = date.toISOString();
        data.createdAtTimestamp = date.getTime();
    }

    return responseHandler(req.headers.accept, res, data, "applications");
});

module.exports = router;
