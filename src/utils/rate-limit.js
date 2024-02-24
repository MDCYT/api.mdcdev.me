const { DB } = require('./db');
const client = new DB(1, "rate-limit");
const RedisStore = require('rate-limit-redis');
const rateLimit = require('express-rate-limit')

module.exports = (minutes, max) => {
        return rateLimit({
            windowMs: 1000 * 60 * minutes, // 15 minutes
            max: (req, res) => {
                return max;
            },
            message: (req, res) => {
                statusCodeHandler({ statusCode: 10001 }, res);
            },
            skip: (req) => {
                if (req.headers['x-api-key'] === process.env.INTERNAL_API_KEY) return true;
        
                return false;
            },
            standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
            legacyHeaders: false, // Disable the `X-RateLimit-*` headers
            store: new RedisStore({
                sendCommand: (...args) => client.sendCommand(args),
            })
        })
}