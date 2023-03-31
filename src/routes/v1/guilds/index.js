const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const rateLimit = require('express-rate-limit')
const axios = require('axios');

const HTTP = require(join(__basedir, 'utils', 'discord', 'HTTP'));
const { Image } = require(join(__basedir, 'utils', 'discord', 'images'));
const RedisRateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join(__basedir, 'utils', 'status-code-handler'));
const { Cache } = require(join(__basedir, 'utils', 'cache'));
const { sortObject } = require(join(__basedir, 'utils', 'utils'));

const cache = new Cache("guilds", 1, 60 * 60 * 3)

const limit = rateLimit({
    windowMs: 1000 * 60 * 60, // 1 hour window
    max: (req, res) => {
        return 50;
    }, // start blocking after 25 requests
    message: (req, res) => {
        statusCodeHandler({ statusCode: 10001 }, res);
    },
    skip: (req, res) => {
        //If the :id is process.env.OWNER_DISCORD_SERVER_ID, skip the rate limit
        if (req.params.id === process.env.OWNER_DISCORD_SERVER_ID) return true;
        return false;
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    store: RedisRateLimit
})

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
            emoji.requiredColons = emoji.require_colons;
            delete emoji.require_colons;

            emoji.managedByIntegration = emoji.managed;
            delete emoji.managed;

            emoji.URL = new Image("CustomEmoji", emoji.id, { format: emoji.animated ? "gif" : "png" }).url;
            emoji.URLs = new Image("CustomEmoji", emoji.id, { format: emoji.animated ? "gif" : "png" }).sizes;
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

    data.bannerURL = new Image("GuildBanner", id, data.banner).url;
    data.bannerURLs = new Image("GuildBanner", id, data.banner).sizes;

    data.defaultMessageNotifications = data.default_message_notifications;
    delete data.default_message_notifications;

    data.discoverySplashURL = new Image("GuildDiscoverySplash", id, data.discovery_splash).url;
    data.discoverySplashURLs = new Image("GuildDiscoverySplash", id, data.discovery_splash).sizes;
    data.discoverySplash = data.discovery_splash;
    delete data.discovery_splash;

    data.explicitContentFilter = data.explicit_content_filter || 0;
    delete data.explicit_content_filter;

    data.homeHeader = data.home_header;
    data.homeHeaderURL = new Image("GuildHomeHeader", id, data.home_header).url;
    data.homeHeaderURLs = new Image("GuildHomeHeader", id, data.home_header).sizes;
    delete data.home_header;

    data.hubType = data.hub_type;
    delete data.hub_type;

    data.iconURL = new Image("GuildIcon", id, data.icon).url;
    data.iconURLs = new Image("GuildIcon", id, data.icon).sizes;

    data.latestOnboardingQuestionId = data.latest_onboarding_question_id;
    delete data.latest_onboarding_question_id;

    data.maxMembers = data.max_members || 1;
    delete data.max_members;

    data.maxPresences = data.max_presences || data.maxMembers || 1;
    delete data.max_presences;

    data.maxStageVideoChannelUsers = data.max_video_channel_users || 1;
    delete data.max_video_channel_users;

    data.maxVideoChannelUsers = data.max_video_channel_users || 1;
    delete data.max_video_channel_users;

    data.mfaLevel = data.mfa_level || 0;
    delete data.mfa_level;

    data.nsfwLevel = data.nsfw_level || 0;
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

    data.premiumProgressBar = data.premium_progress_bar_enabled || false;
    delete data.premium_progress_bar_enabled;

    data.premiumTier = data.premium_tier || 0;
    delete data.premium_tier;

    data.premiumSubscriptionCount = data.premium_subscription_count || 0;
    delete data.premium_subscription_count;

    data.publicUpdatesChannelId = data.public_updates_channel_id;
    delete data.public_updates_channel_id;

    data.rulesChannelId = data.rules_channel_id;
    delete data.rules_channel_id;

    data.safetyAlertsChannelId = data.safety_alerts_channel_id;
    delete data.safety_alerts_channel_id;

    data.splashURL = new Image("GuildSplash", id, data.splash).url;
    data.splashURLs = new Image("GuildSplash", id, data.splash).sizes;

    data.systemChannelFlags = data.system_channel_flags || 0;
    delete data.system_channel_flags;

    data.systemChannelId = data.system_channel_id;
    delete data.system_channel_id;

    data.verificationLevel = data.verification_level || 0;
    delete data.verification_level;

    data.vanityCode = data.vanity_url_code;
    delete data.vanity_url_code;

    if(data.vanityCode) {
        data.vanityURL = `https://discord.gg/${data.vanityCode}`;
    }

    data.widgetChannelId = data.widget_channel_id;
    delete data.widget_channel_id;

    data.widget = data.widget_enabled || false;
    delete data.widget_enabled;

    if(data.widgetChannelId) {
        data.widgetURL = `https://discord.com/widget?id=${id}&theme=dark`;
        data.widgetJSONURL = `https://discord.com/api/guilds/${id}/widget.json`;
    }





    data = sortObject(data);

    return res.status(200).json(data);
});

module.exports = router;