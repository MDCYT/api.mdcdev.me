const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const { Octokit } = require("@octokit/rest");
const fetch = require('node-fetch');

const package = require(join(__basedir, '..', 'package.json'));

const { betterGithubProfileData, betterGithubRepositoriesData, betterGithubGistsData, betterGithubCommentData } = require(join(__basedir, 'utils', 'github', 'utils'));

const { Cache } = require(join(__basedir, 'utils', 'cache'));
const RateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join(__basedir, 'utils', 'status-code-handler'));
const { responseHandler } = require(join(__basedir, 'utils', 'utils'));

const userCache = new Cache("github-users", 0, 60 * 60 * 24 * 1.5)
const userFollowersCache = new Cache("github-users-followers", 0, 60 * 60 * 6)
const userFollowingCache = new Cache("github-users-following", 0, 60 * 60 * 6)
const userRepositoriesCache = new Cache("github-users-repositories", 0, 60 * 60 * 6)
const userGistsCache = new Cache("github-users-gists", 0, 60 * 60 * 6)
const userEventsCache = new Cache("github-users-events", 0, 60 * 60 * 6)
const userOrganizationsCache = new Cache("github-users-organizations", 0, 60 * 60 * 6)
const userStarsCache = new Cache("github-users-stars", 0, 60 * 60 * 6)
const userWatchedCache = new Cache("github-users-watched", 0, 60 * 60 * 6)

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    userAgent: `${package.name}/${package.version}`,
    log: {
        debug: () => {},
        info: () => {},
        warn: console.warn,
        error: console.error
      },
      request: {
        fetch: fetch,
        userAgent: `${package.name}/${package.version}`,
      }
});

const limit = RateLimit(15, 50);

router.get('/:username', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await userCache.get(username);
    if (!data) {
        await octokit.rest.users.getByUsername({username}).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userCache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 16001 }, res);
        })
    }

    if(!data.data) return;

    data = betterGithubProfileData(data.data);

    return responseHandler(req.headers.accept, res, data, "user");

});

router.get('/:username/avatar:ext?', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await userCache.get(username);
    if (!data) {
        await octokit.rest.users.getByUsername({username}).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userCache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 16001 }, res);
        })
    }

    if(!data.data) return;

    let avatar = data.data.avatar_url;

    res.redirect(avatar);

});

router.get('/:username/followers', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await userFollowersCache.get(username);
    if (!data) {
        await octokit.rest.users.listFollowersForUser({username}).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userFollowersCache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 16001 }, res);
        })
    }

    if(!data.data) return;

    data = data.data;

    // Check if the user is in the cache, if not, make a octokit request
    data = await Promise.all(data.map(async user => {
        let details = await userCache.get(user.login);

        if (!details) {
            await octokit.rest.users.getByUsername({username: user.login}).then(async response => {
                if (response.status === 200) {
                    await userCache.set(user.login, response);
                    details = response.data;
                }
            }).catch(err => {
                return;
            });

            // Wait 100 ms and return the details
            await new Promise(resolve => setTimeout(resolve, 100));
        } else {
            details = details.data;
        }

        return betterGithubProfileData(details);

    }));

    return responseHandler(req.headers.accept, res, {users: data}, "users");

});

router.get('/:username/following', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await userFollowingCache.get(username);
    if (!data) {
        await octokit.rest.users.listFollowingForUser({username}).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userFollowingCache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 16001 }, res);
        })
    }

    if(!data.data) return;

    data = data.data;

    // Check if the user is in the cache, if not, make a octokit request
    data = await Promise.all(data.map(async user => {
        let details = await userCache.get(user.login);

        if (!details) {
            await octokit.rest.users.getByUsername({username: user.login}).then(async response => {
                if (response.status === 200) {
                    await userCache.set(user.login, response);
                    details = response.data;
                }
            }).catch(err => {
                return;
            });

            // Wait 100 ms and return the details
            await new Promise(resolve => setTimeout(resolve, 100));
        } else {
            details = details.data;
        }

        return betterGithubProfileData(details);

    }));

    return responseHandler(req.headers.accept, res, {users: data}, "users");

});

router.get(/\/(.*?)(?:\/repos|\/repositories)/, limit, async (req, res) => {
    let username = req.params[0];
    username = username.toLowerCase()
    let data = await userRepositoriesCache.get(username);
    if (!data) {
        await octokit.rest.repos.listForUser({username}).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userRepositoriesCache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 16001 }, res);
        })
    }

    if(!data.data) return;

    data = data.data;

    //Fow every owner, format the data
    data = data.map(repo => {
        repo = betterGithubRepositoriesData(repo);
        return repo;
    });

    return responseHandler(req.headers.accept, res, {repositories: data}, "repositories");

});

router.get('/:username/gists', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await userGistsCache.get(username);
    if (!data) {
        await octokit.rest.gists.listForUser({username}).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userGistsCache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 16001 }, res);
        })
    }

    if(!data.data) return;

    data = data.data;

    data = data.map(gist => {
        gist = betterGithubGistsData(gist);
        return gist;
    });

    return responseHandler(req.headers.accept, res, {gists: data}, "gists");

});

router.get('/:username/events', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await userEventsCache.get(username);
    if (!data) {
        await octokit.rest.activity.listEventsForAuthenticatedUser({username}).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userEventsCache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 16001 }, res);
        })
    }

    if(!data.data) return;

    data = data.data;

    // loop every event, format the data
    data = await Promise.all(data.map(async event => {
        if (event.repo) {
            let repo = event.repo.name;
            let owner = event.repo.name.split("/")[0];
            let details = await userCache.get(owner);
            if (!details) {
                await octokit.rest.users.getByUsername({username: owner}).then(async response => {
                    if (response.status === 200) {
                        await userCache.set(owner, response);
                        details = response.data;
                    }
                }).catch(err => {
                    return;
                });
            } else {
                details = details.data;
            }

            event.repo = betterGithubProfileData(details);
            event.repo.name = repo;
        }

        if (event.actor) {
            let actor = event.actor.login;
            let details = await userCache.get(actor);
            if (!details) {
                await octokit.rest.users.getByUsername({username: actor}).then(async response => {
                    if (response.status === 200) {
                        await userCache.set(actor, response);
                        details = response.data;
                    }
                }).catch(err => {
                    return;
                });
            } else {
                details = details.data;
            }

            event.actor = betterGithubProfileData(details);
        }

        if(data.payload && data.payload.comment) {
            data.payload.comment = betterGithubCommentData(data.payload.comment);
        }

        return event;
    }));
    return responseHandler(req.headers.accept, res, {events: data}, "events");

});

router.get(/\/(.*?)(?:\/orgs|\/organizations)/, limit, async (req, res) => {

    let username = req.params[0];
    username = username.toLowerCase()
    let data = await userOrganizationsCache.get(username);

    if (!data) {
        await octokit.rest.orgs.listForUser({username}).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userOrganizationsCache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 16001 }, res);
        })
    }

    if(!data.data) return;

    data = data.data;

    // loop every event, format the data
    data = await Promise.all(data.map(async org => {
        let details = await userCache.get(org.login);
        if (!details) {
            await octokit.rest.users.getByUsername({username: org.login}).then(async response => {
                if (response.status === 200) {
                    await userCache.set(org.login, response);
                    details = response.data;
                }
            }).catch(err => {
                return;
            });
        } else {
            details = details.data;
        }

        return betterGithubProfileData(details);
    }));

    return responseHandler(req.headers.accept, res, {organizations: data}, "organizations");
});

router.get('/:username/stars', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await userStarsCache.get(username);
    if (!data) {
        await octokit.rest.activity.listReposStarredByUser({username}).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userStarsCache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 16001 }, res);
        })
    }

    if(!data.data) return;

    data = data.data;

    //Fow every owner, format the data
    data = data.map(repo => {
        repo = betterGithubRepositoriesData(repo);
        return repo;
    });

    return responseHandler(req.headers.accept, res, {repositories: data}, "repositories");

});

router.get('/:username/watched', limit, async (req, res) => {
    let { username } = req.params;
    username = username.toLowerCase()
    let data = await userWatchedCache.get(username);
    if (!data) {
        await octokit.rest.activity.listWatchedReposForAuthenticatedUser({username}).then(async details => {
            //If the response is 200, add the user to the cache
            if (details) {
                await userWatchedCache.set(username, details);
                data = details;
            } else {
                return statusCodeHandler({ statusCode: 404 }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 16001 }, res);
        })
    }

    if(!data.data) return;

    data = data.data;

    //Fow every owner, format the data
    data = data.map(repo => {
        repo = betterGithubRepositoriesData(repo);
        return repo;
    });

    return responseHandler(req.headers.accept, res, {repositories: data}, "repositories");

});

module.exports = router;