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
const { sortObject } = require(join(__basedir, 'utils', 'utils'));

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
        data.coverImage = data.cover_image;
    }
    delete data.cover_image;

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

            //Rename membership_state to membershipState
            member.membershipState = member.membership_state;
            delete member.membership_state;

            //Rename team_id to teamId
            member.teamId = member.team_id;
            delete member.team_id;

            //Get a axios get request to the user
            let response = await axios.get(`/v1/users/${member.user.id}`);
            //If the response is 200, replace the user object with the response data
            if (response.status === 200) {
                member.user = response.data;
            }
        });

        //Sort the team members by their membershipState
        data.team.members = data.team.members.sort((a, b) => {
            return a.membershipState - b.membershipState;
        });

        //Rename owner_user_id to ownerUserId
        data.team.ownerUserId = data.team.owner_user_id;
        delete data.team.owner_user_id;
    }

    //If the application has a owner, add it to the object
    if (data.owner) {
        //Get a axios get request to the user
        let response = await axios.get(`/v1/users/${data.owner.id}`);
        //If the response is 200, replace the user object with the response data
        if (response.status === 200) {
            data.owner = response.data;
        }
    }

    //Rename rpc_origins to rpcOrigins
    data.rpcOrigins = data.rpc_origins;
    delete data.rpc_origins;

    //Rename bot_public to isBotPublic
    data.isBotPublic = data.bot_public;
    delete data.bot_public;

    //Rename bot_require_code_grant to isBotRequireCodeGrant
    data.isBotRequireCodeGrant = data.bot_require_code_grant;
    delete data.bot_require_code_grant;

    //Rename terms_of_service_url to termsOfServiceURL
    data.termsOfServiceURL = data.terms_of_service_url;
    delete data.terms_of_service_url;

    //Rename privacy_policy_url to privacyPolicyURL
    data.privacyPolicyURL = data.privacy_policy_url;
    delete data.privacy_policy_url;

    //Rename verify_key to verifyKey
    data.verifyKey = data.verify_key;
    delete data.verify_key;

    //Rename guild_id to guildId
    data.guildId = data.guild_id;
    delete data.guild_id;

    //Rename primary_sku_id to primarySkuId
    data.primarySkuId = data.primary_sku_id;
    delete data.primary_sku_id;

    //Rename flags to publicFlags
    data.publicFlags = data.flags;
    delete data.flags;

    //Get the application's flags
    let flags = new ApplicationFlags(data.publicFlags);
    data.flags = flags.getFlags();

    //Rename install_params to installParams
    data.installParams = data.install_params;
    delete data.install_params;

    //Rename custom_install_url to customInstallURL
    data.customInstallURL = data.custom_install_url;
    delete data.custom_install_url;

    //Rename role_connections_verification_url to roleConnectionsVerificationURL
    data.roleConnectionsVerificationURL = data.role_connections_verification_url;
    delete data.role_connections_verification_url;

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
        } catch (_e) {
            return statusCodeHandler({ statusCode: 11001 }, res);
        }
        let date = new Date(parseInt(data.id) / 4194304 + 1420070400000);

        //Get the createdAt, createdAtTimestamp by Discord Snowflake
        data.createdAt = date.toISOString();
        data.createdAtTimestamp = date.getTime();
    }


    //If have max_participants, rename it to maxParticipants
    if (data.max_participants) {
        data.maxParticipants = data.max_participants;
        delete data.max_participants;
    }

    //Sort the object
    data = sortObject(data);

    return res.status(200).json(data);
});

module.exports = router;
