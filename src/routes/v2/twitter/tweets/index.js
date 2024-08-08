const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const { Rettiwt } = require("rettiwt-api")
const axios = require('axios');

const { Cache } = require(join(__basedir, 'utils', 'cache'));
const RateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join(__basedir, 'utils', 'status-code-handler'));
const { responseHandler } = require(join(__basedir, 'utils', 'utils'));

const tweetsCache = new Cache("twitter-tweets", 0, 60 * 60 * 24 * 30)
const tweetsRetweetsCache = new Cache("twitter-retweets-tweets", 0, 60 * 60 * 24 * 30)

const rettiwt = new Rettiwt({ apiKey: process.env.TWITTER_TOKEN });

const limit = RateLimit(15, 50);

router.get('/:id', limit, async (req, res) => {
    const { id } = req.params;
    let data = await tweetsCache.get(id);
    if (!data) {
        await rettiwt.tweet.details(id).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await tweetsCache.set(id, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 17001 }, res);
        })
    }

    if(!data?.id) return;

    // CreatedAtTimesctamp
    data.createdAtTimestamp = new Date(data.createdAt).getTime();

    // Get the pinned tweet in route "/v2/twitter/tweet/:id" and rename quoted to quotedID
    if (data.quoted) {
        //Get a axios get request to the user
        let response = await axios.get(req.protocol + '://' + req.get('host') + `/v2/twitter/tweets/${data.quoted}`);
        //If the response is 200, replace the user object with the response data
        if (response.status === 200) {
            data.quotedID = data.quoted;
            data.quoted = response.data;
        }
    } else delete data.quoted;

    //Return the user object
    return responseHandler(req.headers.accept, res, data, "tweet");

});

// Deprecated: Twitter (API) doesn't allow to get the likes of a tweet, for now we will return an empty array
router.get('/:id/likes', limit, async (req, res) => {
    return responseHandler(req.headers.accept, res, {users: [], message: "Twitter (API) doesn't allow to get the likes of a tweet"});
});

router.get('/:id/retweets', limit, async (req, res) => {
    const { id } = req.params;
    let data = await tweetsRetweetsCache.get(id);
    if (!data) {
        await rettiwt.tweet.retweeters(id).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await tweetsRetweetsCache.set(id, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 17001 }, res);
        })
    }

    if(!data) return;

    if(!data.list || data.list.length === 0) return responseHandler(req.headers.accept, res, {users: []});

    // In the object are createdAt, make a createdAtTimestamp
    data.list.forEach(retweet => {
        retweet.createdAtTimestamp = new Date(retweet.createdAt).getTime();
    });

    //Return the user object
    return responseHandler(req.headers.accept, res, {users: data.list});

});

module.exports = router;