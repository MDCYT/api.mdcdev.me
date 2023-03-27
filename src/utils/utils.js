function sortObject(object) {
    let sortedObject = {};
    if (Array.isArray(object)) {
        return object.sort();
    }
    if (typeof object !== 'object') {
        return object;
    }
    if (object === null) {
        return object;
    }
    if (object === undefined) {
        return object;
    }
    Object.keys(object).sort().forEach(key => {
        if (typeof object[key] === 'object') {
            sortedObject[key] = sortObject(object[key]);
        } else {
            sortedObject[key] = object[key];
        }
    });
    return sortedObject;
}

module.exports = {
    sortObject
}