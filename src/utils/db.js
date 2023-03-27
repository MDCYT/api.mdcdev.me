const { createClient } = require('redis');

class DB {
    constructor(database, prefix="") {
        this.client = createClient({
            url: process.env.REDIS_URL + "/" + database,
        });

        this.client.on('error', (error) => {
            console.error(error);
        });

        this.prefix = prefix;
        
        this.client.connect();
    }

    async set(key, value) {
        await this.client.set(`${this.prefix}-${key}`, JSON.stringify(value));
    }

    async get(key) {
        return JSON.parse(await this.client.get(`${this.prefix}-${key}`));
    }

    async delete(key) {
        await this.client.del(`${this.prefix}-${key}`);
    }

    async exists(key) {
        return await this.client.exists(`${this.prefix}-${key}`);
    }

    async keys() {
        return await this.client.keys('*');
    }

    async flush() {
        await this.client.flushDb();
    }

    async close() {
        await this.client.quit();
    }

    async expire(key, seconds) {
        await this.client.expire(`${this.prefix}-${key}`, seconds);
    }

    async sendCommand(args) {
        return await this.client.sendCommand(args);
    }
}	

module.exports = {
    DB
};