const { DB } = require('./db');
const client = new DB(1, "rate-limit");
const RedisStore = require('rate-limit-redis');

module.exports = new RedisStore({
    sendCommand: (...args) => client.sendCommand(args),
});