module.exports = {
    BASE_URL: process.env.DISCORD_URL_BASE ? process.env.DISCORD_URL_BASE : 'https://discord.com/api/v10',
    USER_URL(id) {
        return `${this.BASE_URL}/users/${id}`;
    },
    GUILD_URL(id) {
        return `${this.BASE_URL}/guilds/${id}?with_counts=true`;
    },
    INVITE_URL(code, scheduledEventID) {
        console.log(`${this.BASE_URL}/invites/${code}?with_counts=true&with_expiration=true` + (scheduledEventID ? `&guild_scheduled_event_id=${scheduledEventID}` : ''));
        return `${this.BASE_URL}/invites/${code}?with_counts=true&with_expiration=true` + (scheduledEventID ? `&guild_scheduled_event_id=${scheduledEventID}` : '');
    },
    APPLICATION_URL(id) {
        return `${this.BASE_URL}/applications/${id}/rpc`;
    }
};