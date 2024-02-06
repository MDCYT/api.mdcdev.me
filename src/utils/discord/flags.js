class UserFlags {
    constructor(bigInt) {
        this.flags = [];
        this.bigInt = BigInt(bigInt);

        this.allFlags = {
            "DISCORD_EMPLOYEE": 1 << 0,
            "DISCORD_PARTNER": 1 << 1,
            "HYPESQUAD_EVENTS": 1 << 2,
            "BUG_HUNTER_LEVEL_1": 1 << 3,
            "MFA_SMS": 1 << 4,
            "PREMIUM_PROMO_DISMISSED": 1 << 5,
            "HOUSE_BRAVERY": 1 << 6,
            "HOUSE_BRILLIANCE": 1 << 7,
            "HOUSE_BALANCE": 1 << 8,
            "EARLY_SUPPORTER": 1 << 9,
            "TEAM_PSEUDO_USER": 1 << 10,
            "INTERNAL_APPLICATION": 1 << 11,
            "SYSTEM": 1 << 12,
            "HAS_UNREAD_URGENT_MESSAGES": 1 << 13,
            "BUG_HUNTER_LEVEL_2": 1 << 14,
            "UNDERAGE_DELETED": 1 << 15,
            "VERIFIED_BOT": 1 << 16,
            "VERIFIED_BOT_DEVELOPER": 1 << 17,
            "CERTIFIED_MODERATOR": 1 << 18,
            "BOT_HTTP_INTERACTIONS": 1 << 19,
            "SPAMMER": 1 << 20,
            "DISABLE_PREMIUM": 1 << 21,
            "ACTIVE_DEVELOPER": 1 << 22,
            // 31 or more => n
            "DELETED": 1n << 34n,
            "DISABLED_SUSPICIOUS_ACTIVITY": 1n << 35n,
            "SELF_DELETED": 1n << 36n,
            "PREMIUM_DISCRIMINATOR": 1n << 37n,
            "USED_DESKTOP_CLIENT": 1n << 38n,
            "USED_WEB_CLIENT": 1n << 39n,
            "USED_MOBILE_CLIENT": 1n << 40n,
            "DISABLED": 1n << 41n,
            "VERIFIED_EMAIL": 1n << 43n,
            "QUARANTINED": 1n << 44n,
            "COLLABORATOR": 1n << 50n,
            "RESTRICTED_COLLABORATOR": 1n << 51n,
            "NITRO": 1n << 69n,
        }

        this.allFlagsNames = Object.keys(this.allFlags);
        this.allFlagsValues = Object.values(this.allFlags);

        this.getFlags();
    }

    getFlags() {
        for (let i = 0; i < this.allFlagsValues.length; i++) {
            if ((this.bigInt & BigInt(this.allFlagsValues[i])) === BigInt(this.allFlagsValues[i]) && this.flags.includes(this.allFlagsNames[i]) === false) {
                this.flags.push(this.allFlagsNames[i]);
            }
        }
        return this.flags;
    }

    hasFlag(flag) {
        return this.flags.includes(flag);
    }

    addFlag(flag) {
        if (!this.allFlagsNames.includes(flag)) throw new Error('Invalid flag');
        this.bigInt = this.bigInt | BigInt(this.allFlags[flag]);
    }

    removeFlag(flag) {
        if (!this.allFlagsNames.includes(flag)) throw new Error('Invalid flag');
        this.bigInt = this.bigInt & ~BigInt(this.allFlags[flag]);
    }

    setFlags(flags) {
        if (!Array.isArray(flags)) throw new Error('Flags must be an array');
        this.bigInt = BigInt(this.bigInt); // convert the existing bigInt to BigInt type
        for (let i = 0; i < flags.length; i++) {
            this.addFlag(flags[i]);
        }
    }

    toString() {
        return this.bigInt.toString();
    }

    toJSON() {
        return this.bigInt.toString();
    }

    valueOf() {
        return this.bigInt;
    }
};

class ApplicationFlags {
    constructor(bigInt) {
        this.flags = [];
        this.bigInt = BigInt(bigInt);

        this.allFlags = {
            "EMBEDDED_RELEASED": 1 << 1,
            "MANAGED_EMOJI": 1 << 2,
            "EMBEDDED_IAP": 1 << 3,
            "GROUP_DM_CREATE": 1 << 4,
            "RPC_PRIVATE_BETA": 1 << 5,
            "APPLICATION_AUTO_MODERATION_RULE_CREATE_BADGE": 1 << 6,
            "ALLOW_ASSETS": 1 << 8,
            "ALLOW_ACTIVITY_ACTION_SPECTATE": 1 << 9,
            "ALLOW_ACTIVITY_ACTION_JOIN_REQUEST": 1 << 10,
            "RPC_HAS_CONNECTED": 1 << 11,
            "GATEWAY_PRESENCE": 1 << 12,
            "GATEWAY_PRESENCE_LIMITED": 1 << 13,
            "GATEWAY_GUILD_MEMBERS": 1 << 14,
            "GATEWAY_GUILD_MEMBERS_LIMITED": 1 << 15,
            "VERIFICATION_PENDING_GUILD_LIMIT": 1 << 16,
            "EMBEDDED": 1 << 17,
            "GATEWAY_MESSAGE_CONTENT": 1 << 18,
            "GATEWAY_MESSAGE_CONTENT_LIMITED": 1 << 19,
            "EMBEDDED_FIRST_PARTY": 1 << 20,
            "APPLICATION_COMMAND_BADGE": 1 << 23,
            "ACTIVE": 1 << 24
        }

        this.allFlagsNames = Object.keys(this.allFlags);
        this.allFlagsValues = Object.values(this.allFlags);

        this.getFlags();
    }

    getFlags() {
        for (let i = 0; i < this.allFlagsValues.length; i++) {
            if ((this.bigInt & BigInt(this.allFlagsValues[i])) === BigInt(this.allFlagsValues[i]) && this.flags.includes(this.allFlagsNames[i]) === false) {
                this.flags.push(this.allFlagsNames[i]);
            }
        }
        return this.flags;
    }

    hasFlag(flag) {
        return this.flags.includes(flag);
    }

    addFlag(flag) {
        if (!this.allFlagsNames.includes(flag)) throw new Error('Invalid flag');
        this.bigInt = this.bigInt | BigInt(this.allFlags[flag]);
    }

    removeFlag(flag) {
        if (!this.allFlagsNames.includes(flag)) throw new Error('Invalid flag');
        this.bigInt = this.bigInt & ~BigInt(this.allFlags[flag]);
    }

    setFlags(flags) {
        if (!Array.isArray(flags)) throw new Error('Flags must be an array');
        this.bigInt = BigInt(this.bigInt); // convert the existing bigInt to BigInt type
        for (let i = 0; i < flags.length; i++) {
            this.addFlag(flags[i]);
        }
    }

    toString() {
        return this.bigInt.toString();
    }

    toJSON() {
        return this.bigInt.toString();
    }

    valueOf() {
        return this.bigInt;
    }
};

class RoleFlags {
    constructor(bigInt) {
        this.flags = [];
        this.bigInt = BigInt(bigInt);

        this.allFlags = {
            "ROLE_PROMPT": 1 << 1
        }

        this.allFlagsNames = Object.keys(this.allFlags);
        this.allFlagsValues = Object.values(this.allFlags);

        this.getFlags();
    }

    getFlags() {
        for (let i = 0; i < this.allFlagsValues.length; i++) {
            if ((this.bigInt & BigInt(this.allFlagsValues[i])) === BigInt(this.allFlagsValues[i]) && this.flags.includes(this.allFlagsNames[i]) === false) {
                this.flags.push(this.allFlagsNames[i]);
            }
        }
        return this.flags;
    }

    hasFlag(flag) {
        return this.flags.includes(flag);
    }

    addFlag(flag) {
        if (!this.allFlagsNames.includes(flag)) throw new Error('Invalid flag');
        this.bigInt = this.bigInt | BigInt(this.allFlags[flag]);
    }

    removeFlag(flag) {
        if (!this.allFlagsNames.includes(flag)) throw new Error('Invalid flag');
        this.bigInt = this.bigInt & ~BigInt(this.allFlags[flag]);
    }

    setFlags(flags) {
        if (!Array.isArray(flags)) throw new Error('Flags must be an array');
        this.bigInt = BigInt(this.bigInt); // convert the existing bigInt to BigInt type
        for (let i = 0; i < flags.length; i++) {
            this.addFlag(flags[i]);
        }
    }

    toString() {
        return this.bigInt.toString();
    }

    toJSON() {
        return this.bigInt.toString();
    }

    valueOf() {
        return this.bigInt;
    }
};


module.exports = {
    UserFlags,
    ApplicationFlags,
    RoleFlags
}