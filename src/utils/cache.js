const { DB } = require('./db');

//Make a cache class using the redis module, when you create a new cache, you can set the time to live for the cache in seconds
class Cache {
    constructor(prefix, database, ttl) {
        const client = new DB(database, prefix);
        this.client = client;
        this.ttl = ttl;
    }

    //Set a value in the cache
    async set(key, value, ttl = this.ttl) {
        await this.client.set(key, JSON.stringify(value));
        await this.client.expire(key, ttl);
    }

    //Get a value from the cache
    async get(key) {
        return JSON.parse(await this.client.get(key))
    }

    //Delete a value from the cache
    async delete(key) {
        await this.client.delete(key);
    }
}

module.exports = {
    Cache
};