const { Router } = require('express');
const router = Router();
const { join } = require('node:path');

const HTTP = require(join(__basedir, 'utils', 'discord', 'HTTP'));
const Flags = require(join(__basedir, 'utils', 'discord', 'Flags'));

router.get('/:id', (req, res) => {
    const { id } = req.params;
    const http = new HTTP(process.env.DISCORD_BOT_TOKEN);
    http.get('USER_URL', "path", id)
        .then(response => {
            let data = response.data

            //Show the user's flags
            let flags = new Flags(data.public_flags);

            //If user has a banner, or a avatar with "a_" in front of it, add "NITRO" to the flags
            if (data.banner || data.avatar?.startsWith("a_")) flags.addFlag("NITRO");

            //If the user have DISCORD_PARTNER or DISCORD_EMPLOYEE, add "NITRO" to the flags
            if ((flags.hasFlag("DISCORD_PARTNER") || flags.hasFlag("DISCORD_EMPLOYEE")) && !flags.hasFlag("NITRO")) flags.addFlag("NITRO");

            //Add the flags to the user object
            data.flags = flags.getFlags();

            //Convert hash of avatar and banner to a url
            //If the banner or avatar starts with "a_", it's animated, so add ".gif" to the end of the url
            let avatarURL = data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}${data.avatar.startsWith("a_") ? ".gif" : ".png"}` : `https://cdn.discordapp.com/embed/avatars/${Number(data.discriminator) % 5}.png`;
            let bannerURL = data.banner ? `https://cdn.discordapp.com/banners/${data.id}/${data.banner}${data.banner.startsWith("a_") ? ".gif" : ".png"}` : null;

            //Add the avatar and banner url to the user object
            data.avatarURL = avatarURL;
            data.bannerURL = bannerURL;

            //Now add a object called "avatarURLs" and bannerURLs to the user object, and add all the sizes of the avatar and banner
            data.avatarURLs = {
                "16": avatarURL ? avatarURL.concat("?size=16") : null,
                "32": avatarURL ? avatarURL.concat("?size=32") : null,
                "64": avatarURL ? avatarURL.concat("?size=64") : null,
                "128": avatarURL ? avatarURL.concat("?size=128") : null,
                "256": avatarURL ? avatarURL.concat("?size=256") : null,
                "512": avatarURL ? avatarURL.concat("?size=512") : null,
                "1024": avatarURL ? avatarURL.concat("?size=1024") : null,
                "2048": avatarURL ? avatarURL.concat("?size=2048") : null,
                "4096": avatarURL ? avatarURL.concat("?size=4096") : null
            };
            data.bannerURLs = {
                "16": bannerURL ? bannerURL.concat("?size=16") : null,
                "32": bannerURL ? bannerURL.concat("?size=32") : null,
                "64": bannerURL ? bannerURL.concat("?size=64") : null,
                "128": bannerURL ? bannerURL.concat("?size=128") : null,
                "256": bannerURL ? bannerURL.concat("?size=256") : null,
                "512": bannerURL ? bannerURL.concat("?size=512") : null,
                "1024": bannerURL ? bannerURL.concat("?size=1024") : null,
                "2048": bannerURL ? bannerURL.concat("?size=2048") : null,
                "4096": bannerURL ? bannerURL.concat("?size=4096") : null
            };

            //Return the user object
            res.json(data);
        })
        .catch(_error => {
            console.error(_error);
            return res.status(500).json({ message: "Internal server error" });
        })
});

module.exports = router;