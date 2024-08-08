const errorCodes = {
    400: {
        message: "Bad request",
        code: 400
    },
    401: {
        message: "Unauthorized",
        code: 401
    },
    403: {
        message: "Forbidden",
        code: 403
    },
    404: {
        message: "Not found",
        code: 404
    },
    405: {
        message: "Method not allowed",
        code: 405
    },
    429: {
        message: "Too many requests",
        code: 429
    },
    500: {
        message: "Internal server error",
        code: 500
    },
    502: {
        message: "Bad gateway",
        code: 502
    },
    503: {
        message: "Service unavailable",
        code: 503
    },
    504: {
        message: "Gateway timeout",
        code: 504
    }
}

const genericErrorCodes = {
    10001: {
        message: "You have reached the rate limit, please try again later",
        code: 429
    },
    10002: {
        message: "Something went wrong, please try again later",
        code: 500
    },
    10003: {
        message: "You are not authorized to access this resource",
        code: 403
    },
    10004: {
        message: "This resource is not available",
        code: 404
    },
    10005: {
        message: "This resource does not exist",
        code: 404
    },
    10006: {
        message: "Discord API is currently rate limiting you, please try again later",
        code: 429
    },
    10007: {
        message: "Github API is currently rate limiting you, please try again later",
        code: 429
    },
    10008: {
        message: "Twitter API is currently rate limiting you, please try again later",
        code: 429
    },
}

const DiscordUserErrorCodes = {
    11001: {
        message: "User not found",
        code: 404
    },
    11002: {
        message: "User is a bot",
        code: 403
    },
    11003: {
        message: "User is a webhook",
        code: 403
    },
    11004: {
        message: "User dont have banner",
        code: 404
    },
}

const DiscordInviteErrorCodes = {
    12001: {
        message: "Invalid invite code/Friend invite code",
        code: 400
    },
    12002: {
        message: "Invite not found",
        code: 404
    },
    12003: {
        message: "Invite is temporary and expired",
        code: 404
    }
}

const DiscordGuildErrorCodes = {
    13001: {
        message: "Guild not found",
        code: 404
    },
    13002: {
        message: "Guild is unavailable",
        code: 503
    }
}

const DiscordApplicationErrorCodes = {
    14001: {
        message: "Application not found",
        code: 404
    }
}

const TwitterUserErrorCodes = {
    15001: {
        message: "User not found",
        code: 404
    },
    15002: {
        message: "This user dont have banner",
        code: 404
    },
    15003: {
        message: "A error occured when try getting tweets",
        code: 500
    }
}

const TwitterTweetErrorCodes = {
    17001: {
        message: "Tweet not found",
        code: 404
    }
}

const GithubUserErrorCodes = {
    16001: {
        message: "User not found",
        code: 404
    },
}

const customErrorCodes = {
    ...errorCodes,
    ...genericErrorCodes,
    ...DiscordUserErrorCodes,
    ...DiscordGuildErrorCodes,
    ...DiscordInviteErrorCodes,
    ...DiscordApplicationErrorCodes,
    ...TwitterUserErrorCodes,
    ...TwitterTweetErrorCodes,
    ...GithubUserErrorCodes
}

function getCustomErrorCodes(code) {
    //If the custom error code exists, return the custom error code
    if (customErrorCodes[code]) return customErrorCodes[code];
    //If the code is a 5 digit number and custom error code does not exist, return 10002 (generic error)
    return customErrorCodes[10002];
}

module.exports = {
    customErrorCodes,
    getCustomErrorCodes
}