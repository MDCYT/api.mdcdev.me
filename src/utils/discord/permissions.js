class UserPermissions {
    constructor(bigInt) {
        this.permissions = [];
        this.bigInt = BigInt(bigInt);

        this.allPermissions = {
            "CREATE_INSTANT_INVITE": 1 << 0,
            "KICK_MEMBERS": 1 << 1,
            "BAN_MEMBERS": 1 << 2,
            "ADMINISTRATOR": 1 << 3,
            "MANAGE_CHANNELS": 1 << 4,
            "MANAGE_GUILD": 1 << 5,
            "ADD_REACTIONS": 1 << 6,
            "VIEW_AUDIT_LOG": 1 << 7,
            "PRIORITY_SPEAKER": 1 << 8,
            "STREAM": 1 << 9,
            "VIEW_CHANNEL": 1 << 10,
            "SEND_MESSAGES": 1 << 11,
            "SEND_TTS_MESSAGES": 1 << 12,
            "MANAGE_MESSAGES": 1 << 13,
            "EMBED_LINKS": 1 << 14,
            "ATTACH_FILES": 1 << 15,
            "READ_MESSAGE_HISTORY": 1 << 16,
            "MENTION_EVERYONE": 1 << 17,
            "USE_EXTERNAL_EMOJIS": 1 << 18,
            "VIEW_GUILD_INSIGHTS": 1 << 19,
            "CONNECT": 1 << 20,
            "SPEAK": 1 << 21,
            "MUTE_MEMBERS": 1 << 22,
            "DEAFEN_MEMBERS": 1 << 23,
            "MOVE_MEMBERS": 1 << 24,
            "USE_VAD": 1 << 25,
            "CHANGE_NICKNAME": 1 << 26,
            "MANAGE_NICKNAMES": 1 << 27,
            "MANAGE_ROLES": 1 << 28,
            "MANAGE_WEBHOOKS": 1 << 29,
            "MANAGE_EMOJIS": 1 << 30,
            "USE_APPLICATION_COMMANDS": 1 << 31,
            "REQUEST_TO_SPEAK": 1 << 32,
            "MANAGE_EVENTS": 1 << 33,
            "MANAGE_THREADS": 1 << 34,
            "CREATE_PUBLIC_THREADS": 1 << 35,
            "CREATE_PRIVATE_THREADS": 1 << 36,
            "USE_EXTERNAL_STICKERS": 1 << 37,
            "SEND_MESSAGES_IN_THREADS": 1 << 38,
            "USE_EMBEDDED_ACTIVITIES": 1 << 39,
            "MODERATE_MEMBERS": 1 << 40,
            "VIEW_CREATOR_MONETIZATION_ANALYTICS": 1 << 41,
            "USE_SOUNDBOARD": 1 << 42
        }

        this.allPermissionsNames = Object.keys(this.allPermissions);
        this.allPermissionsValues = Object.values(this.allPermissions);

        this.getPermissions();
    }

    getPermissions() {
        for (let i = 0; i < this.allPermissionsValues.length; i++) {
            if ((this.bigInt & BigInt(this.allPermissionsValues[i])) === BigInt(this.allPermissionsValues[i]) && this.permissions.includes(this.allPermissionsNames[i]) === false) {
                this.permissions.push(this.allPermissionsNames[i]);
            }
        }
        return this.permissions;
    }

    hasFlag(flag) {
        return this.permissions.includes(flag);
    }

    addFlag(flag) {
        if (!this.allPermissionsNames.includes(flag)) throw new Error('Invalid flag');
        this.bigInt = this.bigInt | BigInt(this.allPermissions[flag]);
    }

    removeFlag(flag) {
        if (!this.allPermissionsNames.includes(flag)) throw new Error('Invalid flag');
        this.bigInt = this.bigInt & ~BigInt(this.allPermissions[flag]);
    }

    setPermissions(permissions) {
        if (!Array.isArray(permissions)) throw new Error('Permissions must be an array');
        this.bigInt = BigInt(this.bigInt); // convert the existing bigInt to BigInt type
        for (let i = 0; i < permissions.length; i++) {
            this.addFlag(permissions[i]);
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
}

module.exports = {
    UserPermissions
}