const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const rateLimit = require('express-rate-limit')
const { Rettiwt } = require("rettiwt-api")
const axios = require('axios');

const { Cache } = require(join(__basedir, 'utils', 'cache'));
const RedisRateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join(__basedir, 'utils', 'status-code-handler'));

const userCache = new Cache("twitter-users", 0, 60 * 60 * 24 * 1.5)
const tweetsCache = new Cache("twitter-users-tweets", 0, 60 * 60 * 6)
const repliesCache = new Cache("twitter-users-replies", 0, 60 * 60 * 6)
const likesCache = new Cache("twitter-users-likes", 0, 60 * 60 * 6)
const followersCache = new Cache("twitter-users-followers", 0, 60 * 60 * 6)
const followingsCache = new Cache("twitter-users-followings", 0, 60 * 60 * 6)

const rettiwt = new Rettiwt({ apiKey: process.env.TWITTER_TOKEN });

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

router.get('/:username/banner', limit, async (req, res) => {
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

router.get('/:username/timeline', limit, async (req, res) => {
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
    if (data.statusesCount === 0) return res.json({ tweets: [] })

    if (await tweetsCache.has(username)) {
        const tweets = (await tweetsCache.get(username)).list
        tweets.forEach(tweet => {
            if (tweet.tweetBy) {
                delete tweet.isVerified;
            }
        })
        return res.json(await tweetsCache.get(username))
    }

    await rettiwt.user.timeline(data.id, 20).then(async details => {
        if (details) {
            await tweetsCache.set(username, details);
            const tweets = details.list;
            tweets.forEach(tweet => {
                if (tweet.tweetBy) {
                    delete tweet.isVerified;
                }
            })
            res.json({ tweets })
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
    if (data.statusesCount === 0) return res.json({ tweets: [] })

    if (await repliesCache.has(username)) {
        const tweets = (await repliesCache.get(username)).list
        tweets.forEach(tweet => {
            if (tweet.tweetBy) {
                delete tweet.isVerified;
            }
        })
        return res.json(await repliesCache.get(username))
    }

    await rettiwt.user.replies(data.id, 20).then(async details => {
        if (details) {
            await repliesCache.set(username, details);
            const tweets = details.list;
            tweets.forEach(tweet => {
                if (tweet.tweetBy) {
                    delete tweet.isVerified;
                }
            })
            res.json({ tweets })
        } else {
            return statusCodeHandler({ statusCode: 15003 }, res);
        }

    }).catch((e) => {
        console.log(e)
        return statusCodeHandler({ statusCode: 15003 }, res);
    })

    return;

})

router.get('/:username/likes', limit, async (req, res) => {
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
    if (data.statusesCount === 0) return res.json({ tweets: [] })

    if (await likesCache.has(username)) {
        const tweets = (await likesCache.get(username)).list
        tweets.forEach(tweet => {
            if (tweet.tweetBy) {
                delete tweet.isVerified;
            }
        })
        return res.json(await likesCache.get(username))
    }

    await rettiwt.user.likes(data.id, 100).then(async details => {
        if (details) {
            await likesCache.set(username, details);
            const tweets = details.list;
            tweets.forEach(tweet => {
                if (tweet.tweetBy) {
                    delete tweet.isVerified;
                }
            })
            res.json({ tweets })
        } else {
            return statusCodeHandler({ statusCode: 15003 }, res);
        }

    }).catch((e) => {
        console.log(e)
        return statusCodeHandler({ statusCode: 15003 }, res);
    })

    return;

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
    if (data.statusesCount === 0) return res.json({ tweets: [] })

    if (await followersCache.has(username)) return res.json((await followersCache.get(username)).list)

    await rettiwt.user.followers(data.id, 100).then(async details => {
        if (details) {
            await followersCache.set(username, details);
            const followers = details.list;
            followers.forEach(follower => {
                delete follower.isVerified;
            })
            res.json({ followers })
        } else {
            return statusCodeHandler({ statusCode: 15003 }, res);
        }

    }).catch((e) => {
        console.log(e)
        return statusCodeHandler({ statusCode: 15003 }, res);
    })

    return;

})

router.get('/:username/followings', limit, async (req, res) => {
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
    if (data.statusesCount === 0) return res.json({ tweets: [] })

    if (await followingsCache.has(username)) return res.json((await followingsCache.get(username)).list)

    await rettiwt.user.following(data.id, 100).then(async details => {
        if (details) {
            await followingsCache.set(username, details);
            const followings = details.list;
            followings.forEach(user => {
                delete user.isVerified;
            })
            res.json({ followings })
        } else {
            return statusCodeHandler({ statusCode: 15003 }, res);
        }

    }).catch((e) => {
        console.log(e)
        return statusCodeHandler({ statusCode: 15003 }, res);
    })

    return;

})

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