//Make a objecy with all types of images of Discord and return it
const imagesBaseURL = "https://cdn.discordapp.com";

const compatibleImageTypes = {
    "JPEG": [".jpg", ".jpeg"],
    "PNG": [".png"],
    "WebP": [".webp"],
    "GIF": [".gif"],
    "Lottie": [".json"]
}

const cdnEndpoints = {
    /**
     * @param {string} id
     * @returns {string}
     * @example
     * // returns "emojis/123456789012345678"
     * CustomEmoji("123456789012345678")
    */
    CustomEmoji(id) {
        return `emojis/${id}`;
    },

    /**
     * @param {string} guildID
     * @param {string} iconHash
     * @returns {string}
     * @example
     * // returns "icons/123456789012345678/123456789012345678"
     * GuildIcon("123456789012345678", "123456789012345678")
     */
    GuildIcon(guildID, iconHash) {
        return `icons/${guildID}/${iconHash}`;
    },

    /**
     * @param {string} guildID
     * @param {string} splashHash
     * @returns {string}
     * @example
     * // returns "splashes/123456789012345678/123456789012345678"
     * GuildSplash("123456789012345678", "123456789012345678")
     */
    GuildSplash(guildID, splashHash) {
        return `splashes/${guildID}/${splashHash}`;
    },

    /**
     * @param {string} guildID
     * @param {string} discoverySplashHash
     * @returns {string}
     * @example
     * // returns "discovery-splashes/123456789012345678/123456789012345678"
     *  GuildDiscoverySplash("123456789012345678", "123456789012345678")
     */
    GuildDiscoverySplash(guildID, discoverySplashHash) {
        return `discovery-splashes/${guildID}/${discoverySplashHash}`;
    },

    /**
     * @param {string} guildID
     * @param {string} bannerHash
     * @returns {string}
     * @example
     * // returns "banners/123456789012345678/123456789012345678"
     * GuildBanner("123456789012345678", "123456789012345678")
     */
    GuildBanner(guildID, bannerHash) {
        return `banners/${guildID}/${bannerHash}`;
    },
    
    /**
     * @param {string} userID
     * @param {string} bannerHash
     * @returns {string}
     * @example
     * // returns "banners/123456789012345678/123456789012345678"
     * UserBanner("123456789012345678", "123456789012345678")
     */
    UserBanner(userID, bannerHash) {
        return `banners/${userID}/${bannerHash}`;
    },

    /**
     * @param {string | number} discriminatorOrID
     * @returns {string}
     * @example
     * // returns "embed/avatars/0"
     * DefaultUserAvatar("0000")
     * @example
     * // returns "embed/avatars/4"
     * DefaultUserAvatar(4)
     * @example
     * // returns "embed/avatars/4"
     * DefaultUserAvatar(1234)
     * @example
     * // returns "embed/avatars/0"
     * DefaultUserAvatar("#0000")
    * @example
    * // returns "embed/avatars/4"
    * DefaultUserAvatar("#1234")
    */
    DefaultUserAvatar(discriminatorOrID) {
        if (typeof discriminatorOrID === "string") discriminatorOrID = parseInt(discriminatorOrID.replace("#", ""), 10);
        // Check if the number is betweet 1 to 9999
        if (discriminatorOrID >= 1 || discriminatorOrID <= 9999) return `embed/avatars/${discriminatorOrID % 5}`;
        return `embed/avatars/${(discriminatorOrID >> 22) % 6}`;
        
    },

    /**
     * @param {string} userID
     * @param {string} avatarHash
     * @returns {string}
     * @example
     * // returns "avatars/123456789012345678/123456789012345678"
     * UserAvatar("123456789012345678", "123456789012345678")
     */
    UserAvatar(userID, avatarHash) {
        return `avatars/${userID}/${avatarHash}`;
    },

    /**
     * @param {string} guildID
     * @param {string} userID
     * @param {string} avatarHash
     * @returns {string}
     * @example
     * // returns "guilds/123456789012345678/users/123456789012345678/avatars/123456789012345678"
     * GuildMemberAvatar("123456789012345678", "123456789012345678", "123456789012345678")
     */
    GuildMemberAvatar(guildID, userID, avatarHash) {
        return `guilds/${guildID}/users/${userID}/avatars/${avatarHash}`;
    },

    /**
     * @param {string} applicationID
     * @param {string} iconHash
     * @returns {string}
     * @example
     * // returns "app-icons/123456789012345678/123456789012345678"
     * ApplicationIcon("123456789012345678", "123456789012345678")
     */
    ApplicationIcon(applicationID, iconHash) {
        return `app-icons/${applicationID}/${iconHash}`;
    },

    /**
     * @param {string} applicationID
     * @param {string} coverHash
     * @returns {string}
     * @example
     * // returns "app-icons/123456789012345678/123456789012345678"
     * ApplicationCover("123456789012345678", "123456789012345678")
     */
    ApplicationCover(applicationID, coverHash) {
        return `app-icons/${applicationID}/${coverHash}`;
    },

    /**
     * @param {string} applicationID
     * @param {string} assetHash
     * @returns {string}
     * @example
     * // returns "app-assets/123456789012345678/123456789012345678"
     * ApplicationAsset("123456789012345678", "123456789012345678")
     */
    ApplicationAsset(applicationID, assetHash) {
        return `app-assets/${applicationID}/${assetHash}`;
    },

    /**
     * @param {string} applicationID
     * @param {string} achievementID
     * @param {string} iconHash
     * @returns {string}
     * @deprecated Achievements are no longer a thing in Discord
     * @example
     * // returns "app-assets/123456789012345678/achievements/123456789012345678/icons/123456789012345678"
     * AchievementIcon("123456789012345678", "123456789012345678", "123456789012345678")
     */
    AchievementIcon(applicationID, achievementID, iconHash) {
        return `app-assets/${applicationID}/achievements/${achievementID}/icons/${iconHash}`;
    },

    /**
     * @param {string} applicationID
     * @param {string} assetID
     * @returns {string}
     * @deprecated Store is no longer a thing in Discord
     * @example
     * // returns "app-assets/123456789012345678/store/123456789012345678"
     * StorePageAsset("123456789012345678", "123456789012345678")
     */
    StorePageAsset(applicationID, assetID) {
        //app-assets/application_id/store/asset_id	
        return `app-assets/${applicationID}/store/${assetID}`;
    },

    /**
     * @param {string} stickerPackID
     * @returns {string}
     * @example
     * // returns "app-assets/710982414301790216/store/123456789012345678"
     * StickerPackBanner("123456789012345678")
     */
    StickerPackBanner(stickerPackID) {
        return `app-assets/710982414301790216/store/${stickerPackID}`;
    },

    /**
     * @param {string} teamID
     * @param {string} teamIconHash
     * @returns {string}
     * @example
     * // returns "team-icons/123456789012345678/123456789012345678"
     * TeamIcon("123456789012345678", "123456789012345678")
     */
    TeamIcon(teamID, teamIconHash) {
        return `team-icons/${teamID}/${teamIconHash}`;
    },

    /**
     * @param {string} stickerHash
     * @returns {string}
     * @example
     * // returns "stickers/123456789012345678"
     * Sticker("123456789012345678")
     */
    Sticker(stickerHash) {
        return `stickers/${stickerHash}`;
    },

    /**
     * @param {string} roleID
     * @param {string} roleIconHash
     * @returns {string}
     * @example
     * // returns "role-icons/123456789012345678/123456789012345678"
     * RoleIcon("123456789012345678", "123456789012345678")
     */
    RoleIcon(roleID, roleIconHash) {
        return `role-icons/${roleID}/${roleIconHash}`;
    },

    /**
     * @param {string} scheduledEventID
     * @param {string} scheduledEventCoverHash
     * @returns {string}
     * @example
     * // returns "scheduled-events/123456789012345678/123456789012345678"
     * ScheduledEventCover("123456789012345678", "123456789012345678")
     */
    ScheduledEventCover(scheduledEventID, scheduledEventCoverHash) {
        return `scheduled-events/${scheduledEventID}/${scheduledEventCoverHash}`;
    },

    /**
     * @param {string} guildID
     * @param {string} userID
     * @param {string} memberBannerHash
     * @returns {string}
     * @example
     * // returns "guilds/123456789012345678/users/123456789012345678/banners/123456789012345678"
     * GuildMemberBanner("123456789012345678", "123456789012345678", "123456789012345678")
     */
    GuildMemberBanner(guildID, userID, memberBannerHash) {
        return `guilds/${guildID}/users/${userID}/banners/${memberBannerHash}`;
    },

    /**
     * @param {string} guildID
     * @param {string} homeHeaderHash
     * @returns {string}
     * @example
     * // returns "home-headers/603970300668805120/8f48d93ccb430b4d9fa99afbe64b9660"
     * GuildHomeHeader("603970300668805120", "8f48d93ccb430b4d9fa99afbe64b9660")
     */
    GuildHomeHeader(guildID, homeHeaderHash) {
        return `home-headers/${guildID}/${homeHeaderHash}`;
    },

    /**
     * @param {string} avatarDecorationID
     * @returns {string}
     * @example
     * // returns "avatar-decoration-presets/a_7d305bca6cf371df98c059f9d2ef05e4"
     * GuildHomeHeader("a_7d305bca6cf371df98c059f9d2ef05e4")
     */
    AvatarDecoration(avatarDecorationID) {
        return `avatar-decoration-presets/${avatarDecorationID}`;
    },
};

/**
 * @typedef {Object} Image
 * @property {string} type
 * @property {Object} args
 * @property {string} url
 * @property {Object} sizes
 * 
 * @example
 * // returns "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png"
 * new Image("Avatar", "123456789012345678", "123456789012345678").url
 * @example
 * // returns "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png?size=1024"
 * new Image("Avatar", "123456789012345678", "123456789012345678", { size: 1024 }).url
 */
class Image {
    /**
     * @param {string} type
     * @param {...string} args
     * @example
     * // returns "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png"
     * new Image("Avatar", "123456789012345678", "123456789012345678").url
     * @example
     * // returns "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png?size=1024"
     * new Image("Avatar", "123456789012345678", "123456789012345678", { size: 1024 }).url
     * @example
     * // returns "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.webp?size=1024"
     * new Image("Avatar", "123456789012345678", "123456789012345678", { size: 1024, format: "webp" }).url
     */
    constructor(type, ...args) {
        this.type = type;

        //Check the cdnEndpoints for the type, if it doesn't exist, throw an error, cdnEndpoints is function, check if name contains the type
        if (!Object.keys(cdnEndpoints).some(name => name.toLowerCase().includes(type.toLowerCase()))) throw new Error(`Invalid type: ${type}`);

        //Check if the args are valid and have the minimum length for the type
        if (args.length < cdnEndpoints[type].length) throw new Error(`Invalid args for type: ${type}`);

        this.args = args;

        //Check if the last arg is an object, if it is, set it to options, if not, set it to an empty object
        this.options = (typeof args[args.length - 1] === "object" ? args.pop() : {}) ?? {};

        //Check if the options have a size, if it does, set it to size, if not, set it to null
        this.size = this.options.size || null;

        //Check if the options have a format, if it does, set it to format, if not, set it to null
        this.format = this.options.format || null;

        //Check if the options have a dynamic, if it does, set it to dynamic, if not, set it to false
        this.dynamic = this.options.dynamic || false;
        
    }

    /**
     * @returns {string}
     * @example
     * // returns "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png"
     * new Image("Avatar", "123456789012345678", "123456789012345678").url
     * @example
     * // returns "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png?size=1024"
     * new Image("Avatar", "123456789012345678", "123456789012345678", { size: 1024 }).url
     */
    get url() {
        //Get the endpoint from the cdnEndpoints
        const endpoint = cdnEndpoints[this.type](...this.args);

        //Check if the endpoint is a function, if it is, run it, if not, set it to the endpoint
        const url = typeof endpoint === "function" ? endpoint(this.options) : endpoint;

        //Check if the format is null, if it is, set it to png or gif depending if the dynamic option is true, if not, set it to the format depending on the "a_" in the url, if is dynamic, set it to gif, if not, set it to webp
        const format = this.format === null ? this.dynamic ? "gif" : url.includes("a_") ? "gif" : "webp" : this.format;

        //Check if the size is null, if it is, set it to 1024, if not, set it to the size
        const size = this.size === null ? 1024 : this.size;

        //Return the url with the format and size
        return `${imagesBaseURL}/${url}.${format}?size=${size}`;
    }

    /**
     * @returns {string}
     * @example
     * // returns { "16": "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png?size=16", "32": "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png?size=32", "64": "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png?size=64", "128": "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png?size=128", "256": "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png?size=256", "512": "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png?size=512", "1024": "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png?size=1024", "2048": "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png?size=2048", "4096": "https://cdn.discordapp.com/avatars/123456789012345678/123456789012345678.png?size=4096" }
     * new Image("Avatar", "123456789012345678", "123456789012345678").sizes
     */
    get sizes() {
        //Get the endpoint from the cdnEndpoints
        const endpoint = cdnEndpoints[this.type](...this.args);

        //Check if the endpoint is a function, if it is, run it, if not, set it to the endpoint
        const url = typeof endpoint === "function" ? endpoint(this.options) : endpoint;

        //Check if the format is null, if it is, set it to png or gif depending if the dynamic option is true, if not, set it to the format depending on the "a_" in the url, if is dynamic, set it to gif, if not, set it to webp
        const format = this.format === null ? this.dynamic ? "gif" : url.includes("a_") ? "gif" : "webp" : this.format;

        //Return the sizes object
        return {
            "16": `${imagesBaseURL}/${url}.${format}?size=16`,
            "32": `${imagesBaseURL}/${url}.${format}?size=32`,
            "64": `${imagesBaseURL}/${url}.${format}?size=64`,
            "128": `${imagesBaseURL}/${url}.${format}?size=128`,
            "256": `${imagesBaseURL}/${url}.${format}?size=256`,
            "512": `${imagesBaseURL}/${url}.${format}?size=512`,
            "1024": `${imagesBaseURL}/${url}.${format}?size=1024`,
            "2048": `${imagesBaseURL}/${url}.${format}?size=2048`,
            "4096": `${imagesBaseURL}/${url}.${format}?size=4096`
        }

    }


}

module.exports = {
    Image,
    cdnEndpoints,
    compatibleImageTypes
}