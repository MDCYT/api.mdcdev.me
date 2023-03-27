const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const rateLimit = require('express-rate-limit')
const axios = require('axios');

const HTTP = require(join("..", "..", "..", 'utils', 'discord', 'HTTP'));
const { Image } = require(join("..", "..", "..", 'utils', 'discord', 'images'));
const { ApplicationFlags } = require(join("..", "..", "..", 'utils', 'discord', 'flags'));
const RedisRateLimit = require(join("..", "..", "..", 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join("..", "..", "..", 'utils', 'status-code-handler'));
const { Cache } = require(join("..", "..", "..", 'utils', 'cache'));
const { sortObject } = require(join("..", "..", "..", 'utils', 'utils'));

const cache = new Cache("guilds", 1, 60 * 60 * 24)

const limit = rateLimit({
    windowMs: 1000 * 60 * 60, // 1 hour window
    max: (req, res) => {
        return 25;
    }, // start blocking after 25 requests
    message: (req, res) => {
        statusCodeHandler({ statusCode: 10001 }, res);
    },
    skip: (req, res) => {
        //If the :id is process.env.OWNER_DISCORD_SERVER_INVITE, skip the rate limit
        if (req.params.id === process.env.OWNER_DISCORD_SERVER_INVITE) return true;
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
    if (!data) await http.get('INVITE_URL', "path", id).then(async response => {
        //If the response is 200, add the user to the cache
        if (response.status === 200) {
            //Check if have expires_at
            if (response.data.expires_at) {
                //Get the date of when the invite expires
                let date = new Date(response.data.expires_at);
                //Get the difference between the date of when the invite expires and the current date
                let difference = date.getTime() - new Date().getTime();
                //If the difference is less than 0, the invite has expired
                if (difference < 0) {
                    return statusCodeHandler({ statusCode: 12003 }, res);
                }
                //If the difference is more than 0, the invite has not expired
                if (difference > 0) {
                    //Set the cache to expire in the difference
                    await cache.set(id, response.data, difference);
                }
            } else {
                await cache.set(id, response.data);
            }
            data = response.data;
        } else {
            return statusCodeHandler({ statusCode: response.status }, res);
        }
    }).catch(err => {
        return;
    });
    if (!data) return statusCodeHandler({ statusCode: 12001 }, res);

    if (data.guild) {

        // Convert hash of icon, banner and splash to a url
        // If the icon, banner or splash starts with "a_", it's animated, so add ".gif" to the end of the url
        let icon = data.guild.icon ? new Image("GuildIcon", data.guild.id, data.guild.icon) : null;
        let banner = data.guild.banner ? new Image("GuildBanner", data.guild.id, data.guild.banner) : null;
        let splash = data.guild.splash ? new Image("GuildSplash", data.guild.id, data.guild.splash) : null;

        let iconURL = icon ? icon.url : null;
        let bannerURL = banner ? banner.url : null;
        let splashURL = splash ? splash.url : null;

        data.guild.iconURL = iconURL;
        data.guild.bannerURL = bannerURL;
        data.guild.splashURL = splashURL;


        //Now add iconURLs, bannerURLs and splashURLs to the guild object, and add all the sizes of the icon, banner and splash
        if (iconURL) {
            data.guild.iconURLs = icon.sizes
        }
        if (bannerURL) {
            data.guild.bannerURLs = banner.sizes
        }
        if (splashURL) {
            data.guild.splashURLs = splash.sizes
        }



        //If the guild has a vanity url, add it to the data
        if (data.guild.vanity_url_code) {
            data.guild.vanityURL = `https://discord.gg/${data.guild.vanity_url_code}`;
        }

        //Rename vanity_url_code to vanityURLCode
        data.guild.vanityURLCode = data.guild.vanity_url_code;
        delete data.guild.vanity_url_code;

        //Get with the Discord Snowflake the date of when the user was created
        let date = new Date(parseInt(data.guild.id) / 4194304 + 1420070400000);

        //Add the date to the user object
        data.guild.createdAt = date.toISOString();
        data.guild.createdAtTimestamp = date.getTime()

        //Check if exist guild.welcome_screen.welcome_channels
        if (data.guild.welcome_screen && data.guild.welcome_screen.welcome_channels) {
            //Loop through the welcome_channels
            for (let i = 0; i < data.guild.welcome_screen.welcome_channels.length; i++) {
                //Get the date of when the channel was created
                let date = new Date(parseInt(data.guild.welcome_screen.welcome_channels[i].channel_id) / 4194304 + 1420070400000);

                //Add the date to the channel object
                data.guild.welcome_screen.welcome_channels[i].channelCreatedAt = date.toISOString();
                data.guild.welcome_screen.welcome_channels[i].channelCreatedAtTimestamp = date.getTime()

                //If the emoji_id exist, add the url to the emoji object
                if (data.guild.welcome_screen.welcome_channels[i].emoji_id) {
                    //Get the date when the emoji was created
                    date = new Date(parseInt(data.guild.welcome_screen.welcome_channels[i].emoji_id) / 4194304 + 1420070400000);

                    //Add the date to the emoji object
                    data.guild.welcome_screen.welcome_channels[i].emojiCreatedAt = date.toISOString();
                    data.guild.welcome_screen.welcome_channels[i].emojiCreatedAtTimestamp = date.getTime()

                    //Add a url to the emoji
                    data.guild.welcome_screen.welcome_channels[i].emojiURL = new Image("CustomEmoji", data.guild.welcome_screen.welcome_channels[i].emoji_id).url;

                    //Add a urls for the emoji
                    data.guild.welcome_screen.welcome_channels[i].emojiURLs = new Image("CustomEmoji", data.guild.welcome_screen.welcome_channels[i].emoji_id).sizes;
                }

                data.guild.welcome_screen.welcome_channels[i].emojiId = data.guild.welcome_screen.welcome_channels[i].emoji_id
                data.guild.welcome_screen.welcome_channels[i].emojiName = data.guild.welcome_screen.welcome_channels[i].emoji_name
                data.guild.welcome_screen.welcome_channels[i].channelId = data.guild.welcome_screen.welcome_channels[i].channel_id

                delete data.guild.welcome_screen.welcome_channels[i].emoji_id;
                delete data.guild.welcome_screen.welcome_channels[i].emoji_name;
                delete data.guild.welcome_screen.welcome_channels[i].channel_id;

            }

            data.guild.welcome_screen.welcomeChannels = data.guild.welcome_screen.welcome_channels;
            delete data.guild.welcome_screen.welcome_channels;

            data.guild.welcomeScreen = data.guild.welcome_screen;
            delete data.guild.welcome_screen;

        }

        //If in guild.features is "DISCOVERABLE", add a property "isDiscoverable" with the value "true"
        data.guild.isDiscoverable = data.guild.features.includes("DISCOVERABLE");

        //add nsfwLevel property and delete nsfw_level
        data.guild.nsfwLevel = data.guild.nsfw_level;
        delete data.guild.nsfw_level;


        //If premium_subscription_count, add premiumSubscriptionCount property and delete premium_subscription_count
        if (data.guild.premium_subscription_count) {
            data.guild.premiumSubscriptionCount = data.guild.premium_subscription_count;
            data.guild.premiumLevel = data.guild.premium_subscription_count >= 15 ? 3 : data.guild.premium_subscription_count >= 7 ? 2 : data.guild.premium_subscription_count >= 2 ? 1 : 0;
            delete data.guild.premium_subscription_count;
        }

        //If verification_level, add verificationLevel property and delete verification_level
        if (data.guild.verification_level) {
            data.guild.verificationLevel = data.guild.verification_level;
            delete data.guild.verification_level;
        }

    }

    //Check if have a channel
    if (data.channel) {
        //Get the date of when the channel was created
        let date = new Date(parseInt(data.channel.id) / 4194304 + 1420070400000);

        //Add the date to the channel object
        data.channel.createdAt = date.toISOString();
        data.channel.createdAtTimestamp = date.getTime()
    }

    //If have inviter object, with the id of the inviter check the user data
    if (data.inviter) {
        //Make a get request to "/v1/users/:id"
        let response = await axios.get(req.protocol + "://" + req.get("host") + "/v1/users/" + data.inviter.id);

        //If the status code is 200, add the user data to the inviter object
        if (response.status === 200) {
            data.inviter = response.data;
        }

        //If the status code is not 200, remove the inviter object
        if (response.status !== 200) {
            delete data.inviter;
        }
    }

    //If have expires_at, add a property "expiresIn" with the value of the difference between the expires_at and the current time
    if (data.expires_at) {
        data.expiresIn = new Date(data.expires_at) - Date.now();
        data.expiresAtTimestamp = new Date(data.expires_at).getTime();
        data.expiresAt = new Date(data.expires_at).toISOString();

        delete data.expires_at;
    }

    //If have approximate_member_count, add a property "approximateMemberCount" with the value of the approximate_member_count
    if (data.approximate_member_count) {
        data.approximateMemberCount = data.approximate_member_count;
        delete data.approximate_member_count;
    }

    //If have approximate_presence_count, add a property "approximatePresenceCount" with the value of the approximate_presence_count
    if (data.approximate_presence_count) {
        data.approximatePresenceCount = data.approximate_presence_count;
        delete data.approximate_presence_count;
    }

    if (data.target_application) {
        data.targetApplication = data.target_application;
        delete data.target_application;

        data.targetApplication.createdAt = new Date(parseInt(data.targetApplication.id) / 4194304 + 1420070400000).toISOString();
        data.targetApplication.createdAtTimestamp = new Date(parseInt(data.targetApplication.id) / 4194304 + 1420070400000).getTime();

        let response = await axios.get(req.protocol + "://" + req.get("host") + "/v1/users/" + data.targetApplication.id);

        if (response.status === 200) {
            data.targetApplication.user = response.data;
        }

        //Get the flags of the application
        let flags = new ApplicationFlags(data.targetApplication.flags);

        //Convert flags to publicFlags
        data.targetApplication.publicFlags = data.targetApplication.flags;
        delete data.targetApplication.flags;

        //Add flags to the application
        data.targetApplication.flags = flags.getFlags();

        //If exist max_participants, add a property "maxParticipants" with the value of the max_participants
        if (data.targetApplication.max_participants) {
            data.targetApplication.maxParticipants = data.targetApplication.max_participants;
            delete data.targetApplication.max_participants;
        }

        //Add a property "isBotPublic" with the value of the bot_public
        data.targetApplication.isBotPublic = data.targetApplication.bot_public;
        delete data.targetApplication.bot_public;

        //Add a property "isBotRequireCodeGrant" with the value of the bot_require_code_grant
        data.targetApplication.isBotRequireCodeGrant = data.targetApplication.bot_require_code_grant;
        delete data.targetApplication.bot_require_code_grant;

        //if cover_image is not null, add a property "coverImage" with the value of the cover_image
        if (data.targetApplication.cover_image) {
            data.targetApplication.coverImageURL = new Image("ApplicationCover", data.targetApplication.id, data.targetApplication.cover_image).url;
            data.targetApplication.coverImageURLs = new Image("ApplicationCover", data.targetApplication.id, data.targetApplication.cover_image).sizes;
            data.targetApplication.coverImage = data.targetApplication.cover_image
            delete data.targetApplication.cover_image;
        }

        //If have privacy_policy_url add a property "privacyPolicyURL" with the value of the privacy_policy_url
        if (data.targetApplication.privacy_policy_url) {
            data.targetApplication.privacyPolicyURL = data.targetApplication.privacy_policy_url;
            delete data.targetApplication.privacy_policy_url;
        }

        //If have terms_of_service_url add a property "termsOfServiceURL" with the value of the terms_of_service_url
        if (data.targetApplication.terms_of_service_url) {
            data.targetApplication.termsOfServiceURL = data.targetApplication.terms_of_service_url;
            delete data.targetApplication.terms_of_service_url;
        }

        //If verify_key is not null, add a property "verifyKey" with the value of the verify_key
        if (data.targetApplication.verify_key) {
            data.targetApplication.verifyKey = data.targetApplication.verify_key;
            delete data.targetApplication.verify_key;
        }
    }

    //If target_type is 1, add a property "targetType" with the value of the target_type
    if (data.target_type) {
        data.targetType = data.target_type;
        delete data.target_type;
    }

    data.inviteURL = "https://discord.gg/" + data.code;


    data = sortObject(data);

    return res.status(200).json(data);
});

module.exports = router;