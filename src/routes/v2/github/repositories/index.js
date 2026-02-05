const { Router } = require("express");
const router = Router();
const { join } = require("node:path");
const { Octokit } = require("@octokit/rest");
const fetch = require("node-fetch");

const package = require(join(__basedir, "..", "package.json"));

const { betterGithubRepositoriesData, betterGithubProfileData } = require(join(
  __basedir,
  "utils",
  "github",
  "utils"
));

const { Cache } = require(join(__basedir, "utils", "cache"));
const RateLimit = require(join(__basedir, "utils", "rate-limit"));
const { statusCodeHandler } = require(join(
  __basedir,
  "utils",
  "status-code-handler"
));
const { responseHandler } = require(join(__basedir, "utils", "utils"));

const repositoryCache = new Cache("github-repositories", 0, 60 * 60 * 6);
const repositoryLanguagesCache = new Cache(
  "github-repositories-languages",
  0,
  60 * 60 * 1
);
const repositoryTopicsCache = new Cache(
  "github-repositories-topics",
  0,
  60 * 60 * 1
);
const repositoryContributorsCache = new Cache(
  "github-repositories-contributors",
  0,
  60 * 60 * 1
);
const repositoryForksCache = new Cache(
  "github-repositories-forks",
  0,
  60 * 60 * 1
);
const repositoryStarsCache = new Cache(
  "github-repositories-stars",
  0,
  60 * 60 * 1
);
const repositoryWatchersCache = new Cache(
  "github-repositories-watchers",
  0,
  60 * 60 * 1
);

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  userAgent: `${package.name}/${package.version}`,
  log: {
    debug: () => {},
    info: () => {},
    warn: console.warn,
    error: console.error,
  },
  request: {
    fetch: fetch,
    userAgent: `${package.name}/${package.version}`,
  },
});

const limit = RateLimit(15, 50);

router.get("/:username/:repository", limit, async (req, res) => {
  let { username, repository } = req.params;
  username = username.toLowerCase();
  repository = repository.toLowerCase();
  let data = await repositoryCache.get(username + "/" + repository);
  if (!data) {
    await octokit.repos
      .get({ owner: username, repo: repository })
      .then(async (details) => {
        //If the response is 200, add the user to the cache
        if (details) {
          await repositoryCache.set(username + "/" + repository, details);
          data = details;
        } else {
          return statusCodeHandler({ statusCode: 404 }, res);
        }
      })
      .catch((e) => {
        console.log(e);
        return statusCodeHandler({ statusCode: 16001 }, res);
      });
  }

  if (!data.data) return;

  data = betterGithubRepositoriesData(data.data);

  return responseHandler(req.headers.accept, res, data, "repository");
});

router.get("/:username/:repository/languages", limit, async (req, res) => {
  let { username, repository } = req.params;
  username = username.toLowerCase();
  repository = repository.toLowerCase();
  let data = await repositoryLanguagesCache.get(username + "/" + repository);
  if (!data) {
    await octokit.repos
      .listLanguages({ owner: username, repo: repository })
      .then(async (details) => {
        //If the response is 200, add the user to the cache
        if (details) {
          await repositoryLanguagesCache.set(
            username + "/" + repository,
            details
          );
          data = details;
        } else {
          return statusCodeHandler({ statusCode: 404 }, res);
        }
      })
      .catch((e) => {
        console.log(e);
        return statusCodeHandler({ statusCode: 18001 }, res);
      });
  }

  if (!data.data) return statusCodeHandler({ statusCode: 18001 }, res);

  return responseHandler(req.headers.accept, res, data.data, "languages");
});

router.get("/:username/:repository/topics", limit, async (req, res) => {
  let { username, repository } = req.params;
  username = username.toLowerCase();
  repository = repository.toLowerCase();
  let data = await repositoryTopicsCache.get(username + "/" + repository);
  if (!data) {
    await octokit.repos
      .getAllTopics({ owner: username, repo: repository })
      .then(async (details) => {
        //If the response is 200, add the user to the cache
        if (details) {
          await repositoryTopicsCache.set(username + "/" + repository, details);
          data = details;
        } else {
          return statusCodeHandler({ statusCode: 404 }, res);
        }
      })
      .catch((e) => {
        console.log(e);
        return statusCodeHandler({ statusCode: 18001 }, res);
      });
  }

  if (!data.data) return statusCodeHandler({ statusCode: 18001 }, res);

  return responseHandler(req.headers.accept, res, data.data, "topics");
});

router.get("/:username/:repository/contributors", limit, async (req, res) => {
  let { username, repository } = req.params;
  username = username.toLowerCase();
  repository = repository.toLowerCase();
  let data = await repositoryContributorsCache.get(username + "/" + repository);
  if (!data) {
    await octokit.repos
      .listContributors({ owner: username, repo: repository })
      .then(async (details) => {
        //If the response is 200, add the user to the cache
        if (details) {
          await repositoryContributorsCache.set(
            username + "/" + repository,
            details
          );
          data = details;
        } else {
          return statusCodeHandler({ statusCode: 404 }, res);
        }
      })
      .catch((e) => {
        console.log(e);
        return statusCodeHandler({ statusCode: 18001 }, res);
      });
  }

  if (!data.data) return statusCodeHandler({ statusCode: 18001 }, res);

  data = data.data.map((user) => betterGithubProfileData(user));

  return responseHandler(req.headers.accept, res, data, "contributors");
});

router.get("/:username/:repository/forks", limit, async (req, res) => {
  let { username, repository } = req.params;
  username = username.toLowerCase();
  repository = repository.toLowerCase();
  let data = await repositoryForksCache.get(username + "/" + repository);
  if (!data) {
    await octokit.repos
      .listForks({ owner: username, repo: repository })
      .then(async (details) => {
        //If the response is 200, add the user to the cache
        if (details) {
          await repositoryForksCache.set(username + "/" + repository, details);
          data = details;
        } else {
          return statusCodeHandler({ statusCode: 404 }, res);
        }
      })
      .catch((e) => {
        console.log(e);
        return statusCodeHandler({ statusCode: 18001 }, res);
      });
  }

  if (!data.data) return statusCodeHandler({ statusCode: 18001 }, res);

  data = data.data.map((fork) => betterGithubRepositoriesData(fork));

  return responseHandler(req.headers.accept, res, data, "forks");
});

router.get("/:username/:repository/stars", limit, async (req, res) => {
  let { username, repository } = req.params;
  username = username.toLowerCase();
  repository = repository.toLowerCase();
  let data = await repositoryStarsCache.get(username + "/" + repository);
  if (!data) {
    await octokit.activity
      .listStargazersForRepo({ owner: username, repo: repository })
      .then(async (details) => {
        //If the response is 200, add the user to the cache
        if (details) {
          await repositoryStarsCache.set(username + "/" + repository, details);
          data = details;
        } else {
          return statusCodeHandler({ statusCode: 404 }, res);
        }
      })
      .catch((e) => {
        console.log(e);
        return statusCodeHandler({ statusCode: 18001 }, res);
      });
  }

  if (!data.data) return statusCodeHandler({ statusCode: 18001 }, res);

  data = data.data.map((user) => betterGithubProfileData(user));

  return responseHandler(req.headers.accept, res, data, "stars");
});

router.get("/:username/:repository/watchers", limit, async (req, res) => {
  let { username, repository } = req.params;
  username = username.toLowerCase();
  repository = repository.toLowerCase();
  let data = await repositoryWatchersCache.get(username + "/" + repository);
  if (!data) {
    await octokit.activity
      .listWatchersForRepo({ owner: username, repo: repository })
      .then(async (details) => {
        //If the response is 200, add the user to the cache
        if (details) {
          await repositoryWatchersCache.set(
            username + "/" + repository,
            details
          );
          data = details;
        } else {
          return statusCodeHandler({ statusCode: 404 }, res);
        }
      })
      .catch((e) => {
        console.log(e);
        return statusCodeHandler({ statusCode: 18001 }, res);
      });
  }

  if (!data.data) return statusCodeHandler({ statusCode: 18001 }, res);

  data = data.data.map((user) => betterGithubProfileData(user));

  return responseHandler(req.headers.accept, res, data, "watchers");
});

module.exports = router;
