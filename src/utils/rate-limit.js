const { DB } = require("./db");
const client = new DB(1, "rate-limit");
const RedisStore = require("rate-limit-redis");
const rateLimit = require("express-rate-limit");

module.exports = (minutes = 15, max = 50) => {
  return rateLimit({
    windowMs: 1000 * 60 * minutes, // 15 minutes
    max: (req, res) => {
      return max;
    },
    message: (req, res) => {
      statusCodeHandler({ statusCode: 10001 }, res);
    },
    skip: (req) => {
      const [version, app] = req.originalUrl.split("/");

      if (req.headers["x-api-key"] === process.env.INTERNAL_API_KEY)
        return true;
      if (
        req.headers["x-rapidapi-proxy-secret"] ===
        process.env.RAPIDAPI_PROXY_SECRET
      )
        return true;

      if (version === "v1") return false;

      if (version === "v2") {
        switch (app) {
          case "discord":
            if (req.headers["discord-bot-token"]) return true;
            break;
          default:
            return false;
        }
      }

      return false;
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    store: new RedisStore({
      sendCommand: (...args) => client.sendCommand(args),
    }),
  });
};
