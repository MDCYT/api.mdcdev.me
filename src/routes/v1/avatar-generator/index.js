const { Router } = require('express');
const router = Router();
const { join } = require('node:path');
const rateLimit = require('express-rate-limit')

const RedisRateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { statusCodeHandler } = require(join(__basedir, 'utils', 'status-code-handler'));
const { Cache } = require(join(__basedir, 'utils', 'cache'));

const cache = new Cache("avatar-generator", 1, 60 * 60 * 24)

const Canvas = require('@napi-rs/canvas');
const canvas = Canvas.createCanvas(120, 120);
const ctx = canvas.getContext('2d');

const colors = [
    "#FFD1DC", // Rosa pastel
    "#B0E0E6", // Azul cielo suave
    "#E6E6FA", // Lavanda claro
    "#FFFACD", // Amarillo crema
    "#98FB98"  // Verde menta suave
  ];

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

router.get('/:text', limit, async (req, res) => {

    const { text } = req.params;

    // If the cache has the image, return it
    if (await cache.has(text)) {
        res.setHeader('Content-Type', 'image/png');
        res.send(Buffer.from(await cache.get(text)));
        return;
    }

    // Create image with letter a and backround random baed in the number of the string converted to number
    ctx.fillStyle = colors[Math.round(Math.abs(text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 100) % colors.length];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '48px arial';
    ctx.fillText(text, canvas.width / 2 - ctx.measureText(text).width / 2, canvas.height / 2 + 12);
// Save image to cache
    await cache.set(text, await canvas.encode('png'));
    res.setHeader('Content-Type', 'image/png');
    res.send(await canvas.encode('png'));
    
});

module.exports = router;