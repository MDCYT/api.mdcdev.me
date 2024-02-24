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
const { responseHandler } = require(join(__basedir, 'utils', 'utils'));

const cache = new Cache("discord-applications", 1, 60 * 60 * 24)

const limit = rateLimit({
    windowMs: 1000 * 60 * 60, // 1 hour window
    max: (req, res) => {
        return 50;
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

router.get('/:code', limit, async (req, res) => {
    try {
        const { code } = req.params;
        const { event } = req.query;
        const http = new HTTP(process.env.DISCORD_BOT_TOKEN);
        let data = await cache.get(code);
        if (!data) await http.get('INVITE_URL', "path", code, event).then(async response => {
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
                        await cache.set(code, response.data, difference);
                    }
                } else {
                    await cache.set(code, response.data);
                }
                data = response.data;
            } else {
                return statusCodeHandler({ statusCode: response.status }, res);
            }
        }).catch(async (e) => {
            try {
                const new_http = new HTTP();
                await new_http.get('INVITE_URL', "path", code, event).then(async response => {
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
                                await cache.set(code, response.data, difference);
                            }
                        } else {
                            await cache.set(code, response.data);
                        }
                        data = response.data;
                    } else {
                        return statusCodeHandler({ statusCode: response.status }, res);
                    }
                })
            } catch (e) {
                return statusCodeHandler({ statusCode: 12001 }, res);
            }
        })

        if(res.headersSent) return;

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

                }

            }

            //If in guild.features is "DISCOVERABLE", add a property "isDiscoverable" with the value "true"
            data.guild.isDiscoverable = data.guild.features.includes("DISCOVERABLE");

            //If premium_subscription_count, add premiumSubscriptionCount property and delete 
            data.guild.premiumLevel = data.guild.premium_subscription_count >= 15 ? 3 : data.guild.premium_subscription_count >= 7 ? 2 : data.guild.premium_subscription_count >= 2 ? 1 : 0;
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
        } else {
            //expiresIn is -1 if the invite is permanent
            data.expiresIn = -1;
            data.expiresAtTimestamp = -1;
            //expiresAt is in 12 months if the invite is permanent
            data.expiresAt = new Date(Date.now() + 31536000000).toISOString();
        }

        if (data.target_application) {
            let response = await axios.get(req.protocol + "://" + req.get("host") + "/v1/applications/" + data.target_application.id);

            if (response.status === 200) {
                data.targetApplication = response.data;
            } else {
                data.targetApplication = data.target_application;
            }
        }

        //If exists guild_scheduled_event
        if (data.guild_scheduled_event) {
            if ((data.guild_scheduled_event.creator && data.guild_scheduled_event.creator?.id) || data.guild_scheduled_event.creator_id) {
                let id = data.guild_scheduled_event.creator?.id || data.guild_scheduled_event.creator_id;
                let response = await axios.get(req.protocol + "://" + req.get("host") + "/v1/users/" + id);

                if (response.status === 200) {
                    if (data.guild_scheduled_event.creator) {
                        delete data.guild_scheduled_event.creator;
                    }
                    data.guild_scheduled_event.creator = response.data;
                }
            }

            // With discord snowflake, get the date of when the guild scheduled event was created
            let date = new Date(parseInt(data.guild_scheduled_event.id) / 4194304 + 1420070400000);

            //Add the date to the guild scheduled event object
            data.guild_scheduled_event.createdAt = date.toISOString();
            data.guild_scheduled_event.createdAtTimestamp = date.getTime();

            //Rename scheduled_start_time to scheduledStartTime, and add a property scheduledStartTimeTimestamp with the value of the scheduledStartTime
            data.guild_scheduled_event.scheduledStartTimeTimestamp = new Date(data.guild_scheduled_event.scheduled_start_time).getTime();

            //Rename scheduled_end_time to scheduledEndTime, and add a property scheduledEndTimeTimestamp with the value of the scheduledEndTime
            data.guild_scheduled_event.scheduledEndTimeTimestamp = new Date(data.guild_scheduled_event.scheduled_end_time).getTime();

            //Make a property "eventDuration" with the value of the difference between the scheduledEndTime and the scheduledStartTime
            data.guild_scheduled_event.eventDuration = new Date(data.guild_scheduled_event.eventDurationTimestamp).toISOString();

            //get the Image URL
            if (data.guild_scheduled_event.image) {
                data.guild_scheduled_event.imageURL = new Image("ScheduledEventCover", data.guild_scheduled_event.id, data.guild_scheduled_event.image).url;
                data.guild_scheduled_event.imageURLs = new Image("ScheduledEventCover", data.guild_scheduled_event.id, data.guild_scheduled_event.image).sizes;
            }
        }

        data.inviteURL = "https://discord.gg/" + data.code;

        return responseHandler(req.headers.accept, res, data, "invite");
    } catch (error) {
        console.error(error);
        return statusCodeHandler({ statusCode: 10006 }, res);
    }
});

module.exports = router;