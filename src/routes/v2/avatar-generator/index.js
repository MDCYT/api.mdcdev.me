const { Router } = require('express');
const router = Router();
const { join } = require('node:path');

const RateLimit = require(join(__basedir, 'utils', 'rate-limit'));
const { Cache } = require(join(__basedir, 'utils', 'cache'));

const { GlobalFonts, createCanvas } = require('@napi-rs/canvas');

const fs = require('node:fs');

fs.readdirSync(join(__basedir, 'fonts')).forEach(async file => {
    if (file.endsWith(".ttf")) {
        GlobalFonts.registerFromPath(join(__basedir, 'fonts', file), file.replace(".ttf", ""))
    }
});


const cache = new Cache("avatar-generator", 1, 60 * 60 * 24 * 30)

const colors = [
    "#FFD1DC", // Rosa pastel
    "#B0E0E6", // Azul cielo suave
    "#E6E6FA", // Lavanda claro
    "#FFFACD", // Amarillo crema
    "#98FB98"  // Verde menta suave
];

const limit = RateLimit(15, 200);

router.get('/:text', limit, async (req, res) => {

    const { text } = req.params;

    let { fontsize, size, fontcolor, backgroundcolor, font } = req.query;

    // If the cache has the image, return it
    if (await cache.has(`${text} ${fontsize} ${size} ${fontcolor} ${backgroundcolor} ${font}`)) {
        res.setHeader('Content-Type', 'image/png');
        res.send(Buffer.from(await cache.get(text)));
        return;
    }

    const hexColorRegex = /^(([0-9a-fA-F]{2}){3}|([0-9a-fA-F]){3})$/

    fontsize = Number(fontsize)
    size = Number(size)

    if (!fontsize) fontsize = 48;
    if (fontsize <= 0) size = 48;
    if (fontsize >= 512) fontsize = 512;

    if (!size) size = 120;
    if (size <= 0) size = 120;
    if (size >= 1024) size = 1024;

    if (!fontcolor || !hexColorRegex.test(fontcolor)) fontcolor = '#000000';
    else fontcolor = `#${fontcolor}`

    if (!font || !GlobalFonts.has(font)) font = "roboto"
    font = font.toLowerCase();

    if (!backgroundcolor || !hexColorRegex.test(backgroundcolor)) backgroundcolor = colors[Math.round(Math.abs(text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 100) % colors.length];
    else backgroundcolor = `#${backgroundcolor}`

    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Create image with letter a and backround random baed in the number of the string converted to number
    ctx.fillStyle = backgroundcolor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = fontcolor;
    ctx.font = `${fontsize}px ${font}, notocoloremoji, roboto`;
    ctx.fillText(text, canvas.width / 2 - ctx.measureText(text).width / 2, canvas.height / 2 + 12);
    // Save image to cache
    await cache.set(`${text} ${fontsize} ${size} ${fontcolor} ${backgroundcolor} ${font}`, await canvas.encode('png'));
    res.setHeader('Content-Type', 'image/png');
    res.send(await canvas.encode('png'));

});

module.exports = router;