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
}

const userErrorCodes = {
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
}

const inviteErrorCodes = {
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

const guildErrorCodes = {
    13001: {
        message: "Guild not found",
        code: 404
    },
    13002: {
        message: "Guild is unavailable",
        code: 503
    },
    13003: {
        message: "Guild is not available",
        code: 503
    }
}

const customErrorCodes = {
    ...errorCodes,
    ...genericErrorCodes,
    ...userErrorCodes,
    ...guildErrorCodes,
    ...inviteErrorCodes
}

function getCustomErrorCodes(code) {
    //If the code is not a 5 digit number, return 10002 (generic error)
    if (code.toString().length !== 5) return customErrorCodes[10002];
    //If the code is a 5 digit number and custom error code exists, return the custom error code
    if (customErrorCodes[code]) return customErrorCodes[code];
    //If the code is a 5 digit number and custom error code does not exist, return 10002 (generic error)
    return customErrorCodes[10002];
}

module.exports = {
    errorCodes,
    genericErrorCodes,
    userErrorCodes,
    inviteErrorCodes,
    customErrorCodes,
    getCustomErrorCodes
}