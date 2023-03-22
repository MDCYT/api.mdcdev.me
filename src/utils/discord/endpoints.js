module.exports = {
    BASE_URL: process.env.DISCORD_URL_BASE ? process.env.DISCORD_URL_BASE : 'https://discord.com/api/v10',
    USER_URL(id) {
        return `${this.BASE_URL}/users/${id}`;
    }
};