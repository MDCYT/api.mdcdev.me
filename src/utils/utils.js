const { jsXml } = require('json-xml-parse');
const YAML = require('json-to-pretty-yaml');

function sortObject(object, z_a = false) {
    let sortedObject = {};
    if (Array.isArray(object)) {
        // If the object is an array, check of the elements are objects to sort them, and return the array should be sorted
        return object.map(element => {
            if (typeof element === 'object') {
                return sortObject(element);
            }
            return element;
        }).sort();
    }
    if (typeof object !== 'object') {
        return object;
    }
    if (object === null) {
        return object;
    }
    Object.keys(object).sort(z_a ? (a, b) => b.localeCompare(a) : (a, b) => a.localeCompare(b)).forEach(key => {
        if (typeof object[key] === 'object') {
            sortedObject[key] = sortObject(object[key]);
        } else {
            sortedObject[key] = object[key];
        }
    });

    return objectToCamelCase(sortedObject);
}

function objectToCamelCase(obj) {
    // CamelCase the object keys, not the values
    let newObj = {};
    for (let key in obj) {
        newObj[key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] = obj[key];
    }
    return newObj;
}

// I need a function for convert json to xml
function jsonToXml(json) {
    const options = {
        beautify: true,
        selfClosing: true,
        attrKey: "@",
        contentKey: "#",
        entityMap: {
            '"': "&#34;",
            "&": "&#38;"
        },
        declaration: {
            encoding: 'US-ASCII',
            standalone: 'yes'
        }
    }

    return jsXml.toXmlString(options, json);
}

function responseHandler(acceptHeader, res, data, objectname) {
    // Check the accept header and send the response in the correct format
    // Sometime the accept header is like */*,application/json, get the first one
    var rest;
    if (acceptHeader?.includes(',')) {
        rest = acceptHeader.replace(/[^,]+,/, '');
        acceptHeader = acceptHeader.split(',')[0];
    }
    data = sortObject(data);

    res.setHeader('Content-Type', acceptHeader ? acceptHeader : 'application/json');

    switch (acceptHeader) {
        case 'text/xml':
        case 'application/xml':
        case 'application/x-xml':
        case 'text/x-xml':
        case 'text/xsl':
        case 'text/xsl+xml':
            if (objectname) {
                res.send(jsonToXml({ [objectname]: data }));
            } else {
                res.send(jsonToXml(data));
            }
            break;
        case 'text/yaml':
        case 'application/x-yaml':
        case 'application/yaml':
        case 'application/x-yml':
        case 'text/x-yaml':
        case 'text/x-yml':
        case 'text/yml':
            res.send(YAML.stringify(data));
            break;
        case 'application/json':
        case 'text/json':
        case 'text/x-json':
        case 'text/javascript':
            res.json(data);
            break;
        case 'text/plain':
        case 'text/*':
            res.setHeader('Content-Type', 'text/plain');
            res.send(JSON.stringify(data));
            break;
        case 'text/miau':
            res.setHeader('Content-Type', 'text/plain');
            res.send(JSON.stringify(data).replace(/"/g, 'miau'));
            break;
        case 'country/peru':
            // only response the peru emoji
            res.setHeader('Content-Type', 'text/plain');
            res.send('🇵🇪');
            break;
        default:
            if (!rest) {
                res.setHeader('Content-Type', 'application/json');
                res.json(data);
            } else {
                // Check the rest of accept header
                return responseHandler(rest, res, data, objectname);
            }
            break
    }
}

module.exports = {
    sortObject,
    objectToCamelCase,
    responseHandler
}