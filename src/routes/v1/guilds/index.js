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
        console.log(err);
        return;
    });
    if (!data) return statusCodeHandler({ statusCode: 13001 }, res);

    if(data.emojis) {
        data.emojis.forEach(emoji => {
            emoji.isRequiredColons = emoji.require_colons;
            delete emoji.require_colons;

            emoji.isManagedByIntegration = emoji.managed;
            delete emoji.managed;

            emoji.URL = new Image("CustomEmoji", emoji.id, { format: emoji.animated ? "gif" : "png" }).url;
            emoji.URLs = new Image("CustomEmoji", emoji.id, { format: emoji.animated ? "gif" : "png" }).sizes;

            let date = new Date(parseInt(emoji.id) / 4194304 + 1420070400000);
            emoji.createdAt = date;
            emoji.createdTimestamp = date.getTime();
        });
    }

    if(data.stickers) {
        data.stickers.forEach(sticker => {
            sticker.formatType = sticker.format_type;
            delete sticker.format_type;

            sticker.guildId = sticker.guild_id;
            delete sticker.guild_id;

            sticker.isAvailable = sticker.available;
            delete sticker.available;

            let date = new Date(parseInt(sticker.id) / 4194304 + 1420070400000);
            sticker.createdAt = date;
            sticker.createdTimestamp = date.getTime();

            sticker.URL = new Image("Sticker", sticker.id, { format: "png" }).url;
            sticker.URLs = new Image("Sticker", sticker.id, { format: "png" }).sizes;
        });
    }

    if(data.roles) {
        data.roles.forEach(async role => {
            let date = new Date(parseInt(role.id) / 4194304 + 1420070400000);
            role.createdAt = date;
            role.createdTimestamp = date.getTime();

            role.isHoisted = role.hoist;
            delete role.hoist;

            role.isManaged = role.managed;
            delete role.managed;

            role.isMentionable = role.mentionable;
            delete role.mentionable;

            role.unicodeEmoji = role.unicode_emoji;
            delete role.unicode_emoji;

            role.colorHex = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : null;
            role.colorRGB = role.color ? `rgb(${role.color >> 16}, ${(role.color >> 8) & 0xFF}, ${role.color & 0xFF})` : null;

            role.publicFlags = role.flags;
            role.flags = new RoleFlags(role.flags).getFlags();

            role.publicPermissions = role.permissions;
            role.permissions = new UserPermissions(BigInt(role.permissions)).getPermissions();

            if(role.tags) {

                role.tags.botId = role.tags.bot_id;
                delete role.tags.bot_id;

                role.tags.integrationId = role.tags.integration_id;
                delete role.tags.integration_id;

                role.tags.premiumSubscriber = role.tags.premium_subscriber;
                delete role.tags.premium_subscriber;
            }
        });
    }

    data.approximateMemberCount = data.approximate_member_count;
    delete data.approximate_member_count;

    data.approximatePresenceCount = data.approximate_presence_count;
    delete data.approximate_presence_count;

    data.AFKChannelID = data.afk_channel_id;
    delete data.afk_channel_id;

    data.AFKTimeout = data.afk_timeout;
    delete data.afk_timeout;

    data.applicationId = data.application_id;
    delete data.application_id;

    if(data.banner) {
        data.bannerURL = new Image("GuildBanner", id, data.banner).url;
        data.bannerURLs = new Image("GuildBanner", id, data.banner).sizes;
    }

    data.defaultMessageNotifications = data.default_message_notifications;
    delete data.default_message_notifications;

    data.discoverySplash = data.discovery_splash;
    delete data.discovery_splash;
    if(data.discoverySplash) {
        data.discoverySplashURL = new Image("GuildDiscoverySplash", id, data.discoverySplash).url;
        data.discoverySplashURLs = new Image("GuildDiscoverySplash", id, data.discoverySplash).sizes;
    }

    data.explicitContentFilter = data.explicit_content_filter ? data.explicit_content_filter : 0;
    delete data.explicit_content_filter;

    data.homeHeader = data.home_header;
    delete data.home_header;

    if(data.homeHeader){
        data.homeHeaderURL = new Image("GuildHomeHeader", id, data.home_header).url;
        data.homeHeaderURLs = new Image("GuildHomeHeader", id, data.home_header).sizes;
    }

    data.hubType = data.hub_type;
    delete data.hub_type;

    if(data.icon) {
        data.iconURL = new Image("GuildIcon", id, data.icon).url;
        data.iconURLs = new Image("GuildIcon", id, data.icon).sizes;
    }

    data.latestOnboardingQuestionId = data.latest_onboarding_question_id;
    delete data.latest_onboarding_question_id;

    data.maxMembers = data.max_members ? data.max_members : 1;
    delete data.max_members;

    data.maxPresences = data.max_presences ? data.max_presences : data.maxMembers;
    delete data.max_presences;

    data.maxStageVideoChannelUsers = data.max_video_channel_users ? data.max_video_channel_users : 1;
    delete data.max_video_channel_users;

    data.maxVideoChannelUsers = data.max_video_channel_users ? data.max_video_channel_users : 1;
    delete data.max_video_channel_users;

    data.mfaLevel = data.mfa_level ? data.mfa_level : 0;
    delete data.mfa_level;

    data.nsfwLevel = data.nsfw_level ? data.nsfw_level : 0;
    delete data.nsfw_level;

    data.ownerId = data.owner_id;
    delete data.owner_id;

    if(data.ownerId) {
        let response = await axios.get(req.protocol + '://' + req.get('host') + `/v1/users/${data.ownerId}`);
        if(response.status === 200) {
            data.owner = response.data;
        }
    }

    data.preferredLocale = data.preferred_locale;
    delete data.preferred_locale;

    data.premiumProgressBar = Boolean(data.premium_progress_bar_enabled);
    delete data.premium_progress_bar_enabled;

    data.premiumTier = data.premium_tier ? data.premium_tier : 0;
    delete data.premium_tier;

    data.premiumSubscriptionCount = data.premium_subscription_count ? data.premium_subscription_count : 0;
    delete data.premium_subscription_count;

    data.publicUpdatesChannelId = data.public_updates_channel_id;
    delete data.public_updates_channel_id;

    data.rulesChannelId = data.rules_channel_id;
    delete data.rules_channel_id;

    data.safetyAlertsChannelId = data.safety_alerts_channel_id;
    delete data.safety_alerts_channel_id;

    if(data.splash) {
        data.splashURL = new Image("GuildSplash", id, data.splash).url;
        data.splashURLs = new Image("GuildSplash", id, data.splash).sizes;
    }

    data.systemChannelFlags = data.system_channel_flags ? data.system_channel_flags : 0;
    delete data.system_channel_flags;

    data.systemChannelId = data.system_channel_id;
    delete data.system_channel_id;

    data.verificationLevel = data.verification_level ? data.verification_level : 0;
    delete data.verification_level;

    data.vanityCode = data.vanity_url_code;
    delete data.vanity_url_code;

    if(data.vanityCode) {
        data.vanityURL = `https://discord.gg/${data.vanityCode}`;
    }

    data.widgetChannelId = data.widget_channel_id;
    delete data.widget_channel_id;

    data.widget = Boolean(data.widget_enabled);
    delete data.widget_enabled;

    if(data.widgetChannelId) {
        data.widgetURL = `https://discord.com/widget?id=${id}&theme=dark`;
        data.widgetJSONURL = `https://discord.com/api/guilds/${id}/widget.json`;
    }

    data.maxStageVideoChannelUsers = data.max_video_channel_users ? data.max_video_channel_users : 1;
    delete data.max_video_channel_users;

    let date = new Date(data.id / 4194304 + 1420070400000);
    data.createdAt = date.toISOString();
    data.createdTimestamp = date.getTime();

    data.embedChannelId = data.embed_channel_id;
    delete data.embed_channel_id;

    data.embedEnabled = Boolean(data.embed_enabled);
    delete data.embed_enabled;

    return responseHandler(req.headers.accept, res, data, "guild");
});

module.exports = router;