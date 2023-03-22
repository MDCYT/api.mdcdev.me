if(process.env.NODE_ENV !== 'production') require('dotenv').config();

const express = require('express');
const app = express();

const endpoints = require('./utils/discord/endpoints');
const HTTP = require('./utils/discord/HTTP');

const fs = require('node:fs');
const { join } = require('node:path');

const port = process.env.PORT || 3000;

global.__basedir = __dirname;

app.get('/', (req, res) => res.json({ message: 'Hello World!' }));

//We have a folder called "routes", and inside that folder we have a folders called "v1", "v2", "v3" and more, inside those folders we have a folder called "users", "guilds" and more, inside those folders we have a file called "@me.js", "index.js" and more
//This is how we require all the files in the "routes" folder
//The route is the path to the file, and the file is the file that we require
function requireRoutes(path, fullpath = "") {
    fs.readdirSync(join(__dirname, path)).forEach(file => {
        if(file.endsWith(".js")) {
            // app.use(`${fullpath}/${file.replace(".js", "")}`, require(join(__dirname, path, file)));
            // console.log(`Loaded route: ${fullpath}/${file.replace(".js", "")}`);
            //If the file is called index.js, we don't want to add the file name to the route
            if(file === "index.js") {
                app.use(`${fullpath}`, require(join(__dirname, path, file)));
                console.log(`Loaded route: ${fullpath}`);
            } else {
                app.use(`${fullpath}/${file.replace(".js", "")}`, require(join(__dirname, path, file)));
                console.log(`Loaded route: ${fullpath}/${file.replace(".js", "")}`);
            }
        } else {
            requireRoutes(join(path, file), `${fullpath}/${file}`);
        }
    });
}

requireRoutes("routes");

app.all('*', (req, res) => {
    res.status(404).json({ message: 'Not Found' });
});


app.listen(port, () => console.log(`Example app listening on port ${port}!`));