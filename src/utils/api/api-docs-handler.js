const { Router } = require('express');
const swaggerUI = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");

const thePackage = require('../../../package.json')

const router = Router();

const options = {
	definition: {
		openapi: "3.0.0",
		info: {
			title: "MDCDEV API",
			version: thePackage.version,
			description: thePackage.description,
            license: {
                name: "GPL-3.0 license",
                url: "https://github.com/MDCYT/api.mdcdev.me/blob/main/LICENSE"
            },
            contact: {
                name: "Jose Ortiz (MDCDEV)",
                url: "https://discord.gg/dae",
                email: "me@mdcdev.me"
            }
		},
		servers: [
            {
				url: "https://api.mdcdev.me",
                description: "The official MDCDEV API"
			},
			{
				url: "http://localhost:6969",
                description: "The DEV instance (Only for test purposes)"
			},
		],
	},
	apis: ["./src/routes/**/*.js", "./src/openapi/**/*.yaml"]
};

const specs = swaggerJsDoc(options);

router.get('/api-docs', swaggerUI.serve, swaggerUI.setup(specs))

module.exports = router;