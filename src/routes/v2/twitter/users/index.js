const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const { Rettiwt } = require("rettiwt-api")
const axios = require('axios');

const { Cache } = require(join(__basedir, 'utils', 'cache'));
const RateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join(__basedir, 'utils', 'status-code-handler'));
const { responseHandler } = require(join(__basedir, 'utils', 'utils'));

const userCache = new Cache("twitter-users", 0, 60 * 60 * 24 * 1.5)
const tweetsCache = new Cache("twitter-users-tweets", 0, 60 * 60 * 6)
const repliesCache = new Cache("twitter-users-replies", 0, 60 * 60 * 6)
const followersCache = new Cache("twitter-users-followers", 0, 60 * 60 * 6)
const followingsCache = new Cache("twitter-users-followings", 0, 60 * 60 * 6)
const highlightsCache = new Cache("twitter-users-highlights", 0, 60 * 60 * 6)
const subscriptionsCache = new Cache("twitter-users-subscriptions", 0, 60 * 60 * 6)

const rettiwt = new Rettiwt({ apiKey: process.env.TWITTER_TOKEN });

const limit = RateLimit(15, 50);

const betterTwitterProfileData = async (data, req) => {
    // CreatedAtTimesctamp
    data.createdAtTimestamp = new Date(data.createdAt).getTime();

    //Get the data for the pinned tweet
    if (data.pinnedTweet) {
        let tweet = await axios.get(req.protocol + '://' + req.get('host') + '/v2/twitter/tweets/' + data.pinnedTweet, {
            headers: {
                "x-api-key": process.env.INTERNAL_API_KEY
            }
        }).then(res => res.data).catch(e => null);
        if (tweet) {
            delete tweet.tweetBy;
        }
        data.pinnedTweetId = data.pinnedTweet;
        data.pinnedTweet = tweet;
    }

    return data;
}

router.get('/:username', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await userCache.get(username);
    if (!data) {
        await rettiwt.user.details(username).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userCache.set(username, details);
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

    data = await betterTwitterProfileData(data, req);

    return responseHandler(req.headers.accept, res, data, "user");

});

router.get('/:username/avatar(:ext)?', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await userCache.get(username);
    if (!data) {
        await rettiwt.user.details(username).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userCache.set(username, details);
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

router.get('/:username/banner(:ext)?', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await userCache.get(username);
    if (!data) {
        await rettiwt.user.details(username).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userCache.set(username, details);
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

router.get(/\/(.*?)(?:\/replies|\/tweets)/, limit, async (req, res) => {
    let username = req.params[0];
    username = username.toLowerCase()
    let data = await userCache.get(username);
    if (!data) {
        await rettiwt.user.details(username).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userCache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            return statusCodeHandler({ statusCode: 15001 }, res);
        })
    }

    if (!data?.id) return;
    if (data.statusesCount === 0) return responseHandler(req.headers.accept, res, { tweets: [] }, 'tweets')

    if (await tweetsCache.has(username)) return responseHandler(req.headers.accept, res, { tweets: (await tweetsCache.get(username)).list }, 'tweets');

    await rettiwt.user.timeline(data.id, 20).then(async details => {
        if (details) {
            await tweetsCache.set(username, details);
            return responseHandler(req.headers.accept, res, { tweets: details.list }, 'tweets');
        } else {
            return statusCodeHandler({ statusCode: 15003 }, res);
        }

    }).catch((e) => {
        console.log(e)
        return statusCodeHandler({ statusCode: 15003 }, res);
    })

    return;

})

router.get('/:username/replies', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await userCache.get(username);
    if (!data) {
        await rettiwt.user.details(username).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userCache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            return statusCodeHandler({ statusCode: 15001 }, res);
        })
    }

    if (!data?.id) return;
    if (data.statusesCount === 0) return responseHandler(req.headers.accept, res, { tweets: [] }, 'tweets')

    if (await repliesCache.has(username)) return responseHandler(req.headers.accept, res, { tweets: (await repliesCache.get(username)).list }, 'tweets');

    await rettiwt.user.replies(data.id, 20).then(async details => {
        if (details) {
            await repliesCache.set(username, details);
            return responseHandler(req.headers.accept, res, { tweets: details.list }, 'tweets');
        } else {
            return statusCodeHandler({ statusCode: 15003 }, res);
        }

    }).catch((e) => {
        console.log(e)
        return statusCodeHandler({ statusCode: 15003 }, res);
    })

    return;

})

// Deprecated: Twitter (API) doesn't allow to get the likes of a tweet, for now we will return an empty array
router.get('/:username/likes', limit, async (req, res) => {
    return responseHandler(req.headers.accept, res, { tweets: [], message: "Twitter (API) doesn't allow to get the likes of a tweet" }, 'tweets');
})

router.get('/:username/followers', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await userCache.get(username);
    if (!data) {
        await rettiwt.user.details(username).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userCache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            return statusCodeHandler({ statusCode: 15001 }, res);
        })
    }

    if (!data?.id) return;

    if (await followersCache.has(username)) return responseHandler(req.headers.accept, res, { users: (await followersCache.get(username)).list }, "users")

    await rettiwt.user.followers(data.id, 100).then(async details => {
        if (details) {
            await followersCache.set(username, details);
            return responseHandler(req.headers.accept, res, { users: details.list }, "users");
        } else {
            return statusCodeHandler({ statusCode: 15003 }, res);
        }

    }).catch((e) => {
        console.log(e)
        return statusCodeHandler({ statusCode: 15003 }, res);
    })

    return;

})

router.get('/:username/following', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await userCache.get(username);
    if (!data) {
        await rettiwt.user.details(username).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userCache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            return statusCodeHandler({ statusCode: 15001 }, res);
        })
    }

    if (!data?.id) return;

    if (await followingsCache.has(username)) return responseHandler(req.headers.accept, res, { users: (await followingsCache.get(username)).list }, "users")

    await rettiwt.user.following(data.id, 100).then(async details => {
        if (details) {
            await followingsCache.set(username, details);
            return responseHandler(req.headers.accept, res, { users: details.list }, "users");
        } else {
            return statusCodeHandler({ statusCode: 15003 }, res);
        }

    }).catch((e) => {
        console.log(e)
        return statusCodeHandler({ statusCode: 15003 }, res);
    })

    return;

})

router.get('/:username/media', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()

    let account = await axios.get(req.protocol + '://' + req.get('host') + '/v2/twitter/users/' + username, {
        headers: {
            "x-api-key": process.env.INTERNAL_API_KEY
        }
    }).then(res => res.data).catch(e => null);

    await rettiwt.user.media(account.id).then(async details => {
        if (details) {
            return responseHandler(req.headers.accept, res, details.list, "media");
        } else {
            return statusCodeHandler({ statusCode: 15003 }, res);
        }

    }).catch((e) => {
        console.log(e)
        return statusCodeHandler({ statusCode: 15003 }, res);
    })

    return;

})

router.get('/:username/highlights', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()

    let account = await axios.get(req.protocol + '://' + req.get('host') + '/v2/twitter/users/' + username, {
        headers: {
            "x-api-key": process.env.INTERNAL_API_KEY
        }
    }).then(res => res.data).catch(e => null);

    if (await highlightsCache.has(username)) return responseHandler(req.headers.accept, res, { tweets: (await highlightsCache.get(username)).list }, 'tweets');

    await rettiwt.user.highlights(account.id).then(async details => {
        if (details) {
            await highlightsCache.set(username, details);
            return responseHandler(req.headers.accept, res, { tweets: details.list }, 'tweets');
        } else {
            return statusCodeHandler({ statusCode: 15003 }, res);
        }

    }).catch((e) => {
        console.log(e)
        return statusCodeHandler({ statusCode: 15003 }, res);
    })

    return;

})

router.get('/:username/subscriptions', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()

    let account = await axios.get(req.protocol + '://' + req.get('host') + '/v2/twitter/users/' + username, {
        headers: {
            "x-api-key": process.env.INTERNAL_API_KEY
        }
    }).then(res => res.data).catch(e => null);

    if (await subscriptionsCache.has(username)) return responseHandler(req.headers.accept, res, { users: (await subscriptionsCache.get(username)).list }, 'users');

    await rettiwt.user.subscriptions(account.id).then(async details => {
        if (details) {
            await subscriptionsCache.set(username, details);
            return responseHandler(req.headers.accept, res, { users: details.list }, 'users');
        } else {
            return statusCodeHandler({ statusCode: 15003 }, res);
        }

    }).catch((e) => {
        console.log(e)
        return statusCodeHandler({ statusCode: 15003 }, res);
    })

    return;

})

module.exports = router;