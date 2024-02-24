const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const { Octokit } = require("@octokit/rest");
const fecth = require('node-fetch');

const package = require(join(__basedir, '..', 'package.json'));

const { Cache } = require(join(__basedir, 'utils', 'cache'));
const RateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join(__basedir, 'utils', 'status-code-handler'));
const { responseHandler } = require(join(__basedir, 'utils', 'utils'));

const userCache = new Cache("github-users", 0, 60 * 60 * 24 * 1.5)
const userFollowersCache = new Cache("github-users-followers", 0, 60 * 60 * 6)
const userFollowingCache = new Cache("github-users-following", 0, 60 * 60 * 6)
const userRepositoriesCache = new Cache("github-users-repositories", 0, 60 * 60 * 6)
const userGistsCache = new Cache("github-users-gists", 0, 60 * 60 * 6)

const octokit = new Octokit({
    auth: "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",
    userAgent: `${package.name}/${package.version}`,
    log: {
        debug: () => {},
        info: () => {},
        warn: console.warn,
        error: console.error
      },
      request: {
        fetch: fecth,
        userAgent: `${package.name}/${package.version}`,
      }
});

const limit = RateLimit(15, 50);

function betterGithubProfileData(data) {
    data.createdAtTimestamp = new Date(data.created_at).getTime();
    data.updatedAtTimestamp = new Date(data.updated_at).getTime();

    delete data.events_url;
    delete data.followers_url;
    delete data.following_url;
    delete data.gists_url;
    delete data.hub_url;
    delete data.organizations_url;
    delete data.received_events_url;
    delete data.repos_url;
    delete data.starred_url;
    delete data.subscriptions_url;
    delete data.html_url;
    data.username = data.login;
    delete data.login;

    data.url = `https://github.com/${data.username}`;

    return data;
}

function betterGithubRepositoriesData(data) {
    data.createdAtTimestamp = new Date(data.created_at).getTime();
    data.updatedAtTimestamp = new Date(data.updated_at).getTime();
    data.pushedAtTimestamp = new Date(data.pushed_at).getTime();

    delete data.archive_url;
    delete data.assignees_url;
    delete data.blobs_url;
    delete data.branches_url;
    delete data.clone_url;
    delete data.collaborators_url;
    delete data.comments_url;
    delete data.commits_url;
    delete data.compare_url;
    delete data.contents_url;
    delete data.contributors_url;
    delete data.deployments_url;
    delete data.description;
    delete data.downloads_url;
    delete data.events_url;
    delete data.forks_url;
    delete data.git_commits_url;
    delete data.git_refs_url;
    delete data.git_tags_url;
    delete data.git_url;
    delete data.hooks_url;
    delete data.issue_comment_url;
    delete data.issue_events_url;
    delete data.issues_url;
    delete data.keys_url;
    delete data.labels_url;
    delete data.languages_url;
    delete data.merges_url;
    delete data.milestones_url;
    delete data.notifications_url;
    delete data.pulls_url;
    delete data.releases_url;
    delete data.ssh_url;
    delete data.stargazers_url;
    delete data.statuses_url;
    delete data.subscribers_url;
    delete data.subscription_url;
    delete data.svn_url;
    delete data.tags_url;
    delete data.teams_url;
    delete data.trees_url;
    delete data.permissions;

    data.url = data.html_url;
    delete data.html_url;

    data.owner = betterGithubProfileData(data.owner);

    return data;
}

function betterGithubGistsData(data) {
    data.createdAtTimestamp = new Date(data.created_at).getTime();
    data.updatedAtTimestamp = new Date(data.updated_at).getTime();

    delete data.comments_url;
    delete data.commits_url;
    delete data.forks_url;
    delete data.git_pull_url;
    delete data.git_push_url;

    data.url = data.html_url;
    delete data.html_url;

    data.owner = betterGithubProfileData(data.owner);

    //Convert files to a array
    let files = [];
    for (let key in data.files) {
        files.push(data.files[key]);
    }
    data.files = files;

    return data;
}

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
            return statusCodeHandler({ statusCode: 15001 }, res);
        })
    }

    if(!data.data) return;

    data = betterGithubProfileData(data.data);

    return responseHandler(req.headers.accept, res, data, "user");

});

router.get('/:username/avatar', limit, async (req, res) => {
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
            return statusCodeHandler({ statusCode: 15001 }, res);
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
            return statusCodeHandler({ statusCode: 15001 }, res);
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
            return statusCodeHandler({ statusCode: 15001 }, res);
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
            return statusCodeHandler({ statusCode: 15001 }, res);
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
            return statusCodeHandler({ statusCode: 15001 }, res);
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

module.exports = router;