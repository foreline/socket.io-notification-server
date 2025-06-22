/*
 * Authentication middleware
 */

const jwt = require('jsonwebtoken');

class AuthMiddleware
{
    constructor(secretKey)
    {
        this.secretKey = secretKey;
    }
    
    /**
     *
     * @param token
     * @returns {boolean}
     */
    validateToken(token)
    {
        try {
            // @fixme
            return token === this.secretKey;
            //return jwt.verify(token, this.secretKey);
        } catch (error) {
            throw new Error('Invalid authentication token');
        }
    }
    
    /**
     *
     * @param socket
     * @param next
     * @returns {*}
     */
    handle(socket, next)
    {
        const authHeader = socket.handshake.auth?.token
            || socket.handshake.query?.token;
        
        if ( !authHeader ) {
            return next(new Error('Authentication required'));
        }
        
        try {
            socket.decodedToken = this.validateToken(authHeader);
            next();
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AuthMiddleware;