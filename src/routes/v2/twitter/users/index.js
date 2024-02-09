const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const rateLimit = require('express-rate-limit')
const { Rettiwt } = require("rettiwt-api")
const axios = require('axios');

const { Cache } = require(join(__basedir, 'utils', 'cache'));
const RedisRateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler, customErrorCodes } = require(join(__basedir, 'utils', 'status-code-handler'));

const cache = new Cache("twitter-users", 0, 60 * 60 * 24 * 1.5)

const rettiwt = new Rettiwt();

const limit = rateLimit({
    windowMs: 1000 * 60 * 15, // 15 minutes
    max: (req, res) => {
        return 50;
    }, // start blocking after 50 requests
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

router.get('/:username/avatar', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await cache.get(username);
    if (!data) {
        await rettiwt.user.details(username).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await cache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 15001 }, res);
        })
    }

    if (!data?.id) return;

    res.redirect(data.profileImage.replace("_normal", ""))

})

router.get('/:username/banner', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await cache.get(username);
    if (!data) {
        await rettiwt.user.details(username).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await cache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 15001 }, res);
        })
    }

    if (!data?.id) return;

    if (!data.profileBanner) return statusCodeHandler({ statusCode: 15002 }, res);

    res.redirect(data.profileBanner)

})

router.get('/:username', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await cache.get(username);
    if (!data) {
        await rettiwt.user.details(username).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await cache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 15001 }, res);
        })
    }

    if (!data?.id) return;

    // CreatedAtTimesctamp
    data.createdAtTimestamp = new Date(data.createdAt).getTime();

    //Delete isVerified because elon musk is nub
    delete data.isVerified;

    // Get the pinned tweet in route "/v2/twitter/tweet/:id" and rename pinnedTweet to pinnedTweetID
    if (data.pinnedTweet) {
        //Get a axios get request to the user
        let response = await axios.get(req.protocol + '://' + req.get('host') + `/v2/twitter/tweets/${data.pinnedTweet}`);
        //If the response is 200, replace the user object with the response data
        if (response.status === 200) {
            data.pinnedTweetID = data.pinnedTweet;
            data.pinnedTweet = response.data;
            if (data.pinnedTweet.tweetBy?.isVerified) delete data.pinnedTweet.tweetBy.isVerified;
        }
    } else delete data.pinnedTweet;

    //Order all properties in the user object alphabetically, except for the id
    data = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));

    //Return the user object
    res.json(data);

});

module.exports = router;