function sortObject(object, z_a = false) {
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
    Object.keys(object).sort(z_a ? (a, b) => b.localeCompare(a) : (a, b) => a.localeCompare(b)).forEach(key => {
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