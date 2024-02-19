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

module.exports = {
    sortObject,
    objectToCamelCase
}