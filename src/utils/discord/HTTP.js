const axios = require('axios');

const endpoints = require('./endpoints');
const thePackage = require('../../../package.json');

class HTTP {
    constructor(token) {
        this.token = token;
    }

    get(endpoint, type, ...params) {
        switch (type) {
            case 'path':
                return axios.get(endpoints[endpoint](...params), {
                    headers: {
                        Authorization: this.token ? `Bot ${this.token}` : "",
                        'User-Agent': thePackage.name + '/' + thePackage.version,
                        "Content-Type": "application/json",
                    },
                });
            case 'query':
                return axios.get(endpoints[endpoint], {
                    ...params,
                    headers: {
                        Authorization: this.token ? `Bot ${this.token}` : "",
                        'User-Agent': thePackage.name + '/' + thePackage.version,
                        "Content-Type": "application/json",
                    },
                });

            default:
                return axios.get(endpoints[endpoint], {
                    headers: {
                        Authorization: this.token ? `Bot ${this.token}` : "",
                        'User-Agent': thePackage.name + '/' + thePackage.version,
                        "Content-Type": "application/json",
                    },
                });
        }

    }

    post(endpoint, data, params) {
        return axios.post(endpoints[endpoint], data, {
            params,
            headers: {
                Authorization: `Bot ${this.token}`,
                'User-Agent': thePackage.name + '/' + thePackage.version,
                "Content-Type": "application/json",
            },
        });
    }
}

module.exports = HTTP;