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
    const http = new HTTP(req.headers["discord-bot-token"] || process.env.DISCORD_BOT_TOKEN);
    let data = req.headers["discord-bot-token"] ? null : await cache.get(id);
    if (!data) {
        await http.get('USER_URL', "path", id).then(async response => {
            if (response.status === 200) {
                if(!req.headers["discord-bot-token"]) await cache.set(id, response.data);
                data = response.data;
            } else {
                return statusCodeHandler({ statusCode: response.status }, res);
            }

            return null;
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 11001 }, res);
        })
    }

    if(!data?.id) return null;

    data.raw = JSON.parse(JSON.stringify(data))

    if (!data.bot) data.bot = false;

    data.tag = `${data.username}#${data.discriminator}`;

    let flags = new UserFlags(data.public_flags);

    const conditions = {
        dataSystem: data.system,
        dataBannerOrAvatar: data.banner || data.avatar?.startsWith("a_"),
        discordPartnerOrEmployee: (flags.hasFlag("DISCORD_PARTNER") || flags.hasFlag("DISCORD_EMPLOYEE")) && !flags.hasFlag("NITRO")
    };

    const mappedFlags = {
        dataSystem: "SYSTEM",
        dataBannerOrAvatar: "NITRO",
        discordPartnerOrEmployee: "NITRO"
    };

    Object.keys(conditions).forEach(key => {
        if (conditions[key]) {
            flags.addFlag(mappedFlags[key]);
        }
    });

    data.formedFlags = flags.getFlags();

    let avatar = data.avatar ? new Image("UserAvatar", data.id, data.avatar) : new Image("DefaultUserAvatar", (data.discriminator === "0" || !data.discriminator) ? data.id : data.discriminator, { format: "png" });
    let banner = data.banner ? new Image("UserBanner", data.id, data.banner) : null;

    let avatarURL = avatar.url;
    let bannerURL = banner ? banner.url : null;

    data.avatarURL = avatarURL;
    data.bannerURL = bannerURL;

    if (avatarURL) data.avatarURLs = avatar.sizes;
    if (bannerURL) data.bannerURLs = banner.sizes;

    let date = new Date(parseInt(data.id) / 4194304 + 1420070400000);

    data.createdAt = date.toISOString();
    data.createdAtTimestamp = date.getTime();

    if(data.avatar_decoration_data?.asset) data.avatarDecoration = data.avatar_decoration_data?.asset;

    let avatarDecoration = data.avatar_decoration_data?.asset ? new Image("AvatarDecoration", data.avatar_decoration_data.asset, {format: "png"}) : null;

    let avatarDecorationURL = avatarDecoration ? avatarDecoration.url : null;

    data.avatarDecorationURL = avatarDecorationURL;

    if (avatarDecorationURL) data.avatarDecorationURLs = avatarDecoration.sizes;

    delete data.avatar_decoration_data;

    let clanBadge = data.clan ? new Image("ClanBadge", data.clan.identity_guild_id, data.clan.badge) : null;

    let clanBadgeURL = clanBadge ? clanBadge.url : null;

    data.clanBadgeURL = clanBadgeURL;

    data.clanBadgeURLs = clanBadge ? clanBadge.sizes : null;

    return responseHandler(req.headers.accept, res, data, "user");

});

router.get(/\/(\d+)\/avatar(?:\.(\w+))?$/, limit, async (req, res) => {
    // Get data from /:id
    const id = req.params[0];
    let ext = req.params[1];
    
    // If is not gif, webp or png, set it to png, if it's not seted, not set nothing
    if (ext && !["gif", "webp", "png"].includes(ext)) ext = "png";

    const http = new HTTP(req.headers["discord-bot-token"] || process.env.DISCORD_BOT_TOKEN);
    let data = req.headers["discord-bot-token"] ? null : await cache.get(id);
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
    
    let avatar = data.avatar ? new Image("UserAvatar", data.id, data.avatar, { format: ext }) : new Image("DefaultUserAvatar", (data.discriminator === "0" || !data.discriminator) ? data.id : data.discriminator, { format: "png" });

    res.redirect(avatar.url)

    
})

router.get(/\/(\d+)\/banner(?:\.(\w+))?$/, limit, async (req, res) => {
    // Get data from /:id
    const id = req.params[0];
    let ext = req.params[1];
    
    // If is not gif, webp or png, set it to png, if it's not seted, not set nothing
    if (ext && !["gif", "webp", "png"].includes(ext)) ext = "png";

    const http = new HTTP(req.headers["discord-bot-token"] || process.env.DISCORD_BOT_TOKEN);
    let data = req.headers["discord-bot-token"] ? null : await cache.get(id);
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

    if(!data?.id) return null;

    let banner = data.banner ? new Image("UserBanner", data.id, data.banner, { format: ext }) : null;
    if(banner) return res.redirect(banner.url)
    return statusCodeHandler({ statusCode: 11004 }, res);
    
})

router.get(/\/(\d+)\/(?:avatar-decoration|avatardecoration|avatar-decorator|avatardecorator)(?:\.(\w+))?$/, limit, async (req, res) => {

    const id = req.params[0].replace(/\//g, '');
    let ext = req.params[1] || "png";

    if (!["webp", "png"].includes(ext)) ext = "png";

    const http = new HTTP(req.headers["discord-bot-token"] || process.env.DISCORD_BOT_TOKEN);
    let data = req.headers["discord-bot-token"] ? null : await cache.get(id);
    if (!data) {
        await http.get('USER_URL', "path", id).then(async response => {
            //If the response is 200, add the user to the cache
            if (response.status === 200) {
                await cache.set(id, response.data);
                data = response.data;
            } else {
                return statusCodeHandler({ statusCode: response.status }, res);
            }
            
            return null;
        }).catch((e) => {
            console.log(e)
            return statusCodeHandler({ statusCode: 11001 }, res);
        })
    }

    if(!data?.id) return null;

    let avatarDecoration = data.avatar_decoration_data?.asset ? new Image("AvatarDecoration", data.avatar_decoration_data.asset, {format: ext}) : null;

    if(avatarDecoration) return res.redirect(avatarDecoration.url)
    return statusCodeHandler({ statusCode: 11004 }, res);
})

router.get(/\/(\d+)\/(?:clan-badge|clanbadge)(?:\.(\w+))?$/, limit, async (req, res) => {
    const id = req.params[0].replace(/\//g, '');
    let ext = req.params[1] || "png";

    if (!["webp", "png", "gif"].includes(ext)) ext = "png";

    const http = new HTTP(req.headers["discord-bot-token"] || process.env.DISCORD_BOT_TOKEN);
    let data = req.headers["discord-bot-token"] ? null : await cache.get(id);
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

    if(!data?.id) return null;

    let clanBadge = data.clan ? new Image("ClanBadge", data.clan.identity_guild_id, data.clan.badge, {format: ext}) : null;

    if(clanBadge) return res.redirect(clanBadge.url)
    return statusCodeHandler({ statusCode: 11004 }, res);
})

module.exports = router;