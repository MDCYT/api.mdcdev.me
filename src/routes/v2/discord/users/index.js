const { Router } = require('express');
const router = Router();
const { join } = require('node:path');

const HTTP = require(join(__basedir, 'utils', 'discord', 'HTTP'));
const {UserFlags} = require(join(__basedir, 'utils', 'discord', 'flags'));
const { Image } = require(join(__basedir, 'utils', 'discord', 'images'));
const { Cache } = require(join(__basedir, 'utils', 'cache'));
const RateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join(__basedir, 'utils', 'status-code-handler'));
const { responseHandler } = require(join(__basedir, 'utils', 'utils'));

const cache = new Cache("discord-users", 0, 60 * 60 * 24)

const limit = RateLimit(15, 50);

router.get('/:id', limit, async (req, res) => {
    const { id } = req.params;
    const http = new HTTP(process.env.DISCORD_BOT_TOKEN);
    let data = await cache.get(id);
    if (!data) {
        await http.get('USER_URL', "path", id).then(async response => {
            //If the response is 200, add the user to the cache
            if (response.status === 200) {
                await cache.set(id, response.data);
                data = response.data;
            } else {
                return statusCodeHandler({ statusCode: response.status }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 11001 }, res);
        })
    }

    if(!data?.id) return;

    data.raw = JSON.parse(JSON.stringify(data))

    //If the user dont have a bot property, add it to the user object
    if (!data.bot) data.bot = false;

    //If the user has a username and discriminator, add it to the user object
    data.tag = `${data.username}#${data.discriminator}`;

    //Show the user's flags
    let flags = new UserFlags(data.public_flags);

    //If system is true, add "SYSTEM" to the flags
    if (data.system) flags.addFlag("SYSTEM");

    //If user has a banner, or a avatar with "a_" in front of it, add "NITRO" to the flags
    if (data.banner || data.avatar?.startsWith("a_")) flags.addFlag("NITRO");

    //If the user have DISCORD_PARTNER or DISCORD_EMPLOYEE, add "NITRO" to the flags
    if ((flags.hasFlag("DISCORD_PARTNER") || flags.hasFlag("DISCORD_EMPLOYEE")) && !flags.hasFlag("NITRO")) flags.addFlag("NITRO");

    //Add the flags to the user object
    data.formedFlags = flags.getFlags();

    //Convert hash of avatar and banner to a url
    //If the banner or avatar starts with "a_", it's animated, so add ".gif" to the end of the url
    let avatar = data.avatar ? new Image("UserAvatar", data.id, data.avatar) : new Image("DefaultUserAvatar", (data.discriminator === "0" || !data.discriminator) ? data.id : data.discriminator, { format: "png" });
    let banner = data.banner ? new Image("UserBanner", data.id, data.banner) : null;

    let avatarURL = avatar.url;
    let bannerURL = banner ? banner.url : null;

    //Add the avatar and banner url to the user object
    data.avatarURL = avatarURL;
    data.bannerURL = bannerURL;

    //Now add a object called "avatarURLs" and bannerURLs to the user object, and add all the sizes of the avatar and banner
    if (avatarURL) data.avatarURLs = avatar.sizes;
    if (bannerURL) data.bannerURLs = banner.sizes;

    //Get with the Discord Snowflake the date of when the user was created
    let date = new Date(parseInt(data.id) / 4194304 + 1420070400000);

    //Add the date to the user object
    data.createdAt = date.toISOString();
    data.createdAtTimestamp = date.getTime();

    //Get all avatar decorations
    if(data.avatar_decoration_data?.asset) data.avatarDecoration = data.avatar_decoration_data?.asset;

    let avatarDecoration = data.avatar_decoration_data?.asset ? new Image("AvatarDecoration", data.avatar_decoration_data.asset, {format: "png"}) : null;

    let avatarDecorationURL = avatarDecoration ? avatarDecoration.url : null;

    data.avatarDecorationURL = avatarDecorationURL;

    if (avatarDecorationURL) data.avatarDecorationURLs = avatarDecoration.sizes;

    delete data.avatar_decoration_data;

    //Return the user object
    return responseHandler(req.headers.accept, res, data, "user");

});

router.get('/:id/avatar', limit, async (req, res) => {
    // Get data from /:id
    const { id } = req.params;
    const http = new HTTP(process.env.DISCORD_BOT_TOKEN);
    let data = await cache.get(id);
    if (!data) {
        await http.get('USER_URL', "path", id).then(async response => {
            //If the response is 200, add the user to the cache
            if (response.status === 200) {
                await cache.set(id, response.data);
                data = response.data;
            } else {
                return statusCodeHandler({ statusCode: response.status }, res);
            }
        }).catch((e) => {
            return statusCodeHandler({ statusCode: 11001 }, res);
        })
    }

    if(!data?.id) return;

    let avatar = data.avatar ? new Image("UserAvatar", data.id, data.avatar) : new Image("DefaultUserAvatar", (data.discriminator === "0" || !data.discriminator) ? data.id : data.discriminator, { format: "png" });

    res.redirect(avatar.url)

    
})

router.get('/:id/banner', limit, async (req, res) => {
    // Get data from /:id
    const { id } = req.params;
    const http = new HTTP(process.env.DISCORD_BOT_TOKEN);
    let data = await cache.get(id);
    if (!data) {
        await http.get('USER_URL', "path", id).then(async response => {
            //If the response is 200, add the user to the cache
            if (response.status === 200) {
                await cache.set(id, response.data);
                data = response.data;
            } else {
                return statusCodeHandler({ statusCode: response.status }, res);
            }
        }).catch((e) => {
            return statusCodeHandler({ statusCode: 11001 }, res);
        })
    }

    if(!data?.id) return;

    let banner = data.banner ? new Image("UserBanner", data.id, data.banner) : null;

    if(banner) return res.redirect(banner.url)
    return statusCodeHandler({ statusCode: 11004 }, res);
    
})

router.get(/\/(.*?)(?:\/avatar-decoration|avatardecoration|avatar-decorator|avatardecorator)/, limit, async (req, res) => {
    const id = req.params[0].replace(/\//g, '');
    const http = new HTTP(process.env.DISCORD_BOT_TOKEN);
    let data = await cache.get(id);
    if (!data) {
        await http.get('USER_URL', "path", id).then(async response => {
            //If the response is 200, add the user to the cache
            if (response.status === 200) {
                await cache.set(id, response.data);
                data = response.data;
            } else {
                return statusCodeHandler({ statusCode: response.status }, res);
            }
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 11001 }, res);
        })
    }

    if(!data?.id) return;

    let avatarDecoration = data.avatar_decoration_data?.asset ? new Image("AvatarDecoration", data.avatar_decoration_data.asset, {format: "png"}) : null;

    if(avatarDecoration) return res.redirect(avatarDecoration.url)
    return statusCodeHandler({ statusCode: 11004 }, res);
    
})

module.exports = router;