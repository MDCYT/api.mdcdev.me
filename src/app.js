if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const express = require('express');
const fs = require('node:fs');
const { join } = require('node:path');
const morgan = require('morgan')
const path = require('path')
const axios = require('axios');

const { statusCodeHandler } = require(join(__dirname, 'utils', 'status-code-handler'));
const errorHandler = require(join(__dirname, 'utils', 'api', 'error-handler'));
const apiDocsHandler = require(join(__dirname, 'utils', 'api', 'api-docs-handler'));

const app = express();

const port = process.env.PORT || 3000;

global.__basedir = __dirname;

// var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })

// app.use(morgan('combined', { stream: accessLogStream }))

// Make a morgan, if detected a error, log to a discord webhook, if not, log to a file, and if the NODE_ENV is development, log to the console too
function logToDiscord(ip, userAgent, url, method, statusCode, message) {
    const webhook = process.env.DISCORD_WEBHOOK;
    if (webhook) {
        axios.post(webhook, {
            content: `Error detected in the MDCDEV API\n\`\`\`json\n${JSON.stringify({ip, userAgent, url, method, statusCode, message }, null, 2)}\n\`\`\``
        });
    }
}

app.use(morgan('dev', {
    skip: (req, res) => res.statusCode < 400,
}));

app.use((req, res, next) => {
    res.on('finish', () => {
        if (res.statusCode >= 400 && res.statusCode < 600) {
            let fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
            logToDiscord(req.ip, req.headers['user-agent'], fullUrl, req.method, res.statusCode, res.statusMessage);
        }
    });
    next();
});

const streamFile = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: streamFile }));

app.use("/access.log", (req, res) => {
    res.sendFile(path.join(__dirname, 'access.log'));
});
    

app.use(errorHandler)
app.use("/api-docs", apiDocsHandler);

//Replace the X-Powered-By header with our own
app.use((req, res, next) => {
    res.setHeader('X-Powered-By', 'Discord API');
    res.setHeader('X-Developer', 'MDC#0001');
    res.setHeader('X-Developer-Website', 'https://mdcdev.me');
    res.setHeader('X-Developer-Github', 'https://github.com/MDCYT');
    res.setHeader('X-Developer-Twitter', 'https://twitter.com/MDCYT');
    res.setHeader('X-Developer-Discord', 'https://discord.gg/dae');
    next();
});

//Allow CORS    
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

//We have a folder called "routes", and inside that folder we have a folders called "v1", "v2", "v3" and more, inside those folders we have a folder called "users", "guilds" and more, inside those folders we have a file called "@me.js", "index.js" and more
//This is how we require all the files in the "routes" folder
//The route is the path to the file, and the file is the file that we require
async function requireRoutes(path, fullpath = "") {
    fs.readdirSync(join(__dirname, path)).forEach(async file => {
        if (file.endsWith(".js")) {
            if (file === "index.js") {
                app.use(`${fullpath.replace("~", ":")}`, require(join(__dirname, path, file)));
                console.log(`Loaded route: ${fullpath.replace("~", ":")}`);
            } else {
                app.use(`${fullpath.replace(".js", ).replace("~", ":")}/${file.replace(".js", "")}`, require(join(__dirname, path, file)));
                console.log(`Loaded route: ${fullpath.replace(".js", ).replace("~", ":")}/${file.replace(".js", "")}`);
            }
            // app.use(`${fullpath}/${file.replace(".js", "")}`, require(join(__dirname, path, file)));
            // console.log(`Loaded route: ${fullpath}/${file.replace(".js", "")}`);
            //If the file is called index.js, we don't want to add the file name to the route
        } else {
            await requireRoutes(join(path, file), `${fullpath}/${file}`);
        }

    });
}

requireRoutes("routes");

app.get('/', (req, res) => res.json({ message: 'Welcome to the MDCDEV API', documentation: 'https://docs.api.mdcdev.me' }));

app.all('*', (req, res) => {
    statusCodeHandler({ statusCode: 10005 }, res);
});


app.listen(port, () => console.log(`API listening on port ${port}!`));