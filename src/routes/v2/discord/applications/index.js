const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const axios = require('axios');

const HTTP = require(join(__basedir, 'utils', 'discord', 'HTTP'));
const { Image } = require(join(__basedir, 'utils', 'discord', 'images'));
const { ApplicationFlags } = require(join(__basedir, 'utils', 'discord', 'flags'));
const RateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join(__basedir, 'utils', 'status-code-handler'));
const { Cache } = require(join(__basedir, 'utils', 'cache'));
const { responseHandler } = require(join(__basedir, 'utils', 'utils'));

const cache = new Cache("discord-applications", 1, 60 * 60 * 24)

const limit = RateLimit(15, 25);

router.get('/:id', limit, async (req, res) => {
    const { id } = req.params;
    const http = new HTTP(process.env.DISCORD_BOT_TOKEN);
    let data = await cache.get(id);
    if (!data) await http.get('APPLICATION_URL', "path", id).then(async response => {
        //If the response is 200, add the user to the cache
        if (response.status === 200) {
            await cache.set(id, response.data);
            data = response.data;
        } else {
            return statusCodeHandler({ statusCode: response.status }, res);
        }
    }).catch(err => {
        return statusCodeHandler({ statusCode: 14001 }, res);
    });
    if (!data) return statusCodeHandler({ statusCode: 14001 }, res);


    //If the application has a cover image, add it to the object
    if (data.cover_image) {
        data.coverImageURL = new Image("ApplicationCover", data.id, data.cover_image).url;
        data.coverImageURLs = new Image("ApplicationCover", data.id, data.cover_image).sizes;
    }

    //If the application has a icon, add it to the object
    if (data.icon) {
        data.iconURL = new Image("ApplicationIcon", data.id, data.icon).url;
        data.iconURLs = new Image("ApplicationIcon", data.id, data.icon).sizes;
    }

    if (data.team) {
        if (data.team.icon) {
            data.team.iconURL = Image("TeamIcon", data.team.id, data.team.icon).url;
            data.team.iconURLs = Image("TeamIcon", data.team.id, data.team.icon).sizes;
        }

        data.team.members.forEach(async member => {

            //Get a axios get request to the user
            let response = await axios.get(req.protocol + '://' + req.get('host') + `/v1/users/${member.user.id}`);
            //If the response is 200, replace the user object with the response data
            if (response.status === 200) {
                member.user = response.data;
            }
        });

        //Sort the team members by their membershipState
        data.team.members = data.team.members.sort((a, b) => {
            return a.membershipState - b.membershipState;
        });
    }

    //If the application has a owner, add it to the object
    if (data.owner) {
        //Get a axios get request to the user
        let response = await axios.get(req.protocol + '://' + req.get('host') + `/v1/users/${data.owner.id}`);
        //If the response is 200, replace the user object with the response data
        if (response.status === 200) {
            data.owner = response.data;
        }
    }

    //Get the application's flags
    data.publicFlags = data.flags;
    let flags = new ApplicationFlags(data.publicFlags);
    data.flags = flags.getFlags();    

    //If have id, get the user from api
    if (data.id) {
        //Get a axios get request to the user
        try {
            await axios.get(req.protocol + '://' + req.get('host') + `/v1/users/${data.id}`).then((response) => {
                //If the response is 200, replace the user object with the response data
                if (response.status === 200) {
                    data.user = response.data;
                }
            }).catch((_e) => {
            });
        } catch ([]) {
            // Some apps don't have a user, or have a user id different from the application id
            data.user = null;
        }
        let date = new Date(parseInt(data.id) / 4194304 + 1420070400000);

        //Get the createdAt, createdAtTimestamp by Discord Snowflake
        data.createdAt = date.toISOString();
        data.createdAtTimestamp = date.getTime();
    }

    return responseHandler(req.headers.accept, res, data, "applications");
});

module.exports = router;
