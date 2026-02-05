if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const express = require('express');
const fs = require('node:fs');
const { join } = require('node:path');
const morgan = require('morgan');
require("./utils/instrument");

const { statusCodeHandler } = require(join(__dirname, 'utils', 'status-code-handler'));
const errorHandler = require(join(__dirname, 'utils', 'api', 'error-handler'));

const app = express();

const port = process.env.PORT || 3000;

global.__basedir = __dirname;

app.use(morgan('dev', {
    skip: (req, res) => res.statusCode < 400,
}));

app.use(errorHandler)

//Replace the X-Powered-By header with our own
app.use((req, res, next) => {
    res.setHeader('X-Powered-By', 'Any Dev Code');
    res.setHeader('X-Developer', 'MDCDEV');
    res.setHeader('X-Developer-Website', 'https://mdcdev.me');
    res.setHeader('X-Developer-Github', 'https://github.com/MDCYT');
    res.setHeader('X-Developer-Twitter', 'https://twitter.com/MDC_DEV');
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

// Rutas deshabilitadas
const DISABLED_ROUTES = process.env.DISABLED_ROUTES 
    ? process.env.DISABLED_ROUTES.split(',').map(r => r.trim())
    : [];

//We have a folder called "routes", and inside that folder we have a folders called "v1", "v2", "v3" and more, inside those folders we have a folder called "users", "guilds" and more, inside those folders we have a file called "@me.js", "index.js" and more
//This is how we require all the files in the "routes" folder
//The route is the path to the file, and the file is the file that we require
function requireRoutes(path, fullpath = "") {
    fs.readdirSync(join(__dirname, path)).forEach(file => {
        if (file.endsWith(".js")) {
            let routePath = "";
            if (file === "index.js") {
                routePath = `${fullpath.replace("~", ":")}`;
            } else {
                routePath = `${fullpath.replace(".js", ).replace("~", ":")}/${file.replace(".js", "")}`;
            }
            
            // Verificar si la ruta está deshabilitada
            const isDisabled = DISABLED_ROUTES.some(disabled => routePath.includes(disabled));
            
            if (isDisabled) {
                console.log(`⛔ Ruta deshabilitada (saltada): ${routePath}`);
            } else {
                if (file === "index.js") {
                    app.use(`${fullpath.replace("~", ":")}`, require(join(__dirname, path, file)));
                    console.log(`✅ Ruta cargada: ${fullpath.replace("~", ":")}`);
                } else {
                    app.use(`${fullpath.replace(".js", ).replace("~", ":")}/${file.replace(".js", "")}`, require(join(__dirname, path, file)));
                    console.log(`✅ Ruta cargada: ${fullpath.replace(".js", ).replace("~", ":")}/${file.replace(".js", "")}`);
                }
            }
        } else {
            requireRoutes(join(path, file), `${fullpath}/${file}`);
        }

    });
}

requireRoutes("routes");

app.get('/', (req, res) => res.json({ message: 'Welcome to the MDCDEV API', documentation: 'https://docs.api.mdcdev.me' }));

app.all('*', (req, res) => {
    statusCodeHandler({ statusCode: 10005 }, res);
});


app.listen(port, () => console.log(`API listening on port ${port}!`));

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
});
process.on('uncaughtException', (err, origin) => {
    console.error(`Caught exception: ${err}\nException origin: ${origin}`);
});