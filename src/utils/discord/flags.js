module.exports = class Flags {
    constructor(bigInt) {
        this.flags = [];
        this.bigInt = BigInt(bigInt);

        this.allFlags = {
            "DISCORD_EMPLOYEE": 1 << 0,
            "DISCORD_PARTNER": 1 << 1,
            "HYPESQUAD_EVENTS": 1 << 2,
            "BUG_HUNTER_LEVEL_1": 1 << 3,
            "HOUSE_BRAVERY": 1 << 6,
            "HOUSE_BRILLIANCE": 1 << 7,
            "HOUSE_BALANCE": 1 << 8,
            "EARLY_SUPPORTER": 1 << 9,
            "TEAM_PSEUDO_USER": 1 << 10,
            "SYSTEM": 1 << 12,
            "BUG_HUNTER_LEVEL_2": 1 << 14,
            "VERIFIED_BOT": 1 << 16,
            "VERIFIED_BOT_DEVELOPER": 1 << 17,
            "CERTIFIED_MODERATOR": 1 << 18,
            "BOT_HTTP_INTERACTIONS": 1 << 19,
            "ACTIVE_DEVELOPER": 1 << 22,
            "NITRO": 1n << 123n,
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
