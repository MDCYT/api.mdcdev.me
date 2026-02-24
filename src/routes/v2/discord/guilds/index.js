const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const axios = require('axios');

const HTTP = require(join(__basedir, 'utils', 'discord', 'HTTP'));
const { Image } = require(join(__basedir, 'utils', 'discord', 'images'));
const { RoleFlags } = require(join(__basedir, 'utils', 'discord', 'flags'));
const { UserPermissions } = require(join(__basedir, 'utils', 'discord', 'permissions'));
const RateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join(__basedir, 'utils', 'status-code-handler'));
const { Cache } = require(join(__basedir, 'utils', 'cache'));
const { responseHandler } = require(join(__basedir, 'utils', 'utils'));

const cache = new Cache("discord-guilds", 3, 60 * 60 * 3)

const limit = RateLimit(60, 50);

router.get('/:id', limit, async (req, res) => {
    const { id } = req.params;
    const http = new HTTP(process.env.DISCORD_BOT_TOKEN);
    let data = await cache.get(id);
    if (!data) await http.get('GUILD_URL', "path", id).then(async response => {
        //If the response is 200, add the user to the cache
        if (response.status === 200) {
            //Check if have expires_at

            await cache.set(id, response.data);

            data = response.data;
        } else {
            return statusCodeHandler({ statusCode: response.status }, res);
        }
    }).catch(err => {
        return;
    });
    if (!data) return statusCodeHandler({ statusCode: 13001 }, res);

    if (data.emojis) {
        data.emojis.forEach(emoji => {
            emoji.URL = new Image("CustomEmoji", emoji.id, { format: emoji.animated ? "gif" : "png" }).url;
            emoji.URLs = new Image("CustomEmoji", emoji.id, { format: emoji.animated ? "gif" : "png" }).sizes;

            let date = new Date(parseInt(emoji.id) / 4194304 + 1420070400000);
            emoji.createdAt = date;
            emoji.createdTimestamp = date.getTime();
        });
    }

    if (data.stickers) {
        data.stickers.forEach(sticker => {
            let date = new Date(parseInt(sticker.id) / 4194304 + 1420070400000);
            sticker.createdAt = date;
            sticker.createdTimestamp = date.getTime();

            sticker.URL = new Image("Sticker", sticker.id, { format: "png" }).url;
            sticker.URLs = new Image("Sticker", sticker.id, { format: "png" }).sizes;
        });
    }

    if (data.roles) {
        data.roles.forEach(async role => {
            let date = new Date(parseInt(role.id) / 4194304 + 1420070400000);
            role.createdAt = date;
            role.createdTimestamp = date.getTime();

            role.colorHex = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : null;
            role.colorRGB = role.color ? `rgb(${role.color >> 16}, ${(role.color >> 8) & 0xFF}, ${role.color & 0xFF})` : null;

            role.publicFlags = role.flags;
            role.flags = new RoleFlags(role.flags).getFlags();

            role.publicPermissions = role.permissions;
            role.permissions = new UserPermissions(BigInt(role.permissions)).getPermissions();
        });
    }

    if (data.banner) {
        data.bannerURL = new Image("GuildBanner", id, data.banner).url;
        data.bannerURLs = new Image("GuildBanner", id, data.banner).sizes;
    }

    data.discoverySplash = data.discovery_splash;
    delete data.discovery_splash;
    if (data.discoverySplash) {
        data.discoverySplashURL = new Image("GuildDiscoverySplash", id, data.discoverySplash).url;
        data.discoverySplashURLs = new Image("GuildDiscoverySplash", id, data.discoverySplash).sizes;
    }

    if (data.homeHeader) {
        data.homeHeaderURL = new Image("GuildHomeHeader", id, data.home_header).url;
        data.homeHeaderURLs = new Image("GuildHomeHeader", id, data.home_header).sizes;
    }

    if (data.icon) {
        data.iconURL = new Image("GuildIcon", id, data.icon).url;
        data.iconURLs = new Image("GuildIcon", id, data.icon).sizes;
    }

    if (data.ownerId) {
        let response = await axios.get(req.protocol + '://' + req.get('host') + `/v1/users/${data.ownerId}`);
        if (response.status === 200) {
            data.owner = response.data;
        }
    }

    if (data.splash) {
        data.splashURL = new Image("GuildSplash", id, data.splash).url;
        data.splashURLs = new Image("GuildSplash", id, data.splash).sizes;
    }

    if (data.vanityCode) data.vanityURL = `https://discord.gg/${data.vanityCode}`;

    if (data.widgetChannelId) {
        data.widgetURL = `https://discord.com/widget?id=${id}&theme=dark`;
        data.widgetJSONURL = `https://discord.com/api/guilds/${id}/widget.json`;
    }

    let date = new Date(data.id / 4194304 + 1420070400000);
    data.createdAt = date.toISOString();
    data.createdTimestamp = date.getTime();

    data.explicit_content_filter = data.explicit_content_filter || 0;
    data.max_members = data.max_members || 1;
    data.max_presences = data.max_presences || data.max_members || 1;
    data.max_video_channel_users = data.max_video_channel_users || 1;
    data.mfa_level = data.mfa_level || 0;
    data.nsfw_level = data.nsfw_level || 0;
    data.premium_progress_bar_enabled = data.premium_progress_bar_enabled || false;
    data.premium_tier = data.premium_tier || 0;
    data.premium_subscription_count = data.premium_subscription_count || 0;
    data.system_channel_flags = data.system_channel_flags || 0;
    data.verification_level = data.verification_level || 0;
    data.widget_enabled = data.widget_enabled || false;
    data.embed_enabled = data.embed_enabled || false;

    return responseHandler(req.headers.accept, res, data, "guild");
});

module.exports = router;