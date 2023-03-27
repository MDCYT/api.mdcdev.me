const { getCustomErrorCodes } = require('./error-codes');

module.exports = {
    /**
     * 
     * @param {Objec} err Object with the error code
     * @param {Object} res The response object from express
     * @returns {Object} The response object
     * @example
     * const { statusCodeHandler } = require(join("..", "..", "..", 'utils', 'status-code-handler'));
     * const { Router } = require('express');
     * const router = Router();
     * router.get('/:id', async (req, res) => {
     *    const { id } = req.params;   
     *   if(!id) return statusCodeHandler({ statusCode: 11001 }, res);
     *   else return res.status(200).json({ message: "User found", code: 200 });
     * });
     */
    statusCodeHandler: (err, res) => {

        return res.status(getCustomErrorCodes(err.statusCode).code).json({ message: getCustomErrorCodes(err.statusCode).message, code: err.statusCode });

    }
}