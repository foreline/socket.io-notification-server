/*
 * Authentication middleware
 */

const jwt = require('jsonwebtoken');

class AuthMiddleware {
    constructor(secretKey) {
        this.secretKey = secretKey;
    }
    
    validateToken(token) {
        try {
            return jwt.verify(token, this.secretKey);
        } catch (error) {
            throw new Error('Invalid authentication token');
        }
    }
    
    handle(socket, next) {
        const authHeader = socket.handshake.auth?.token ||
            socket.handshake.query?.token;
        
        if (!authHeader) {
            return next(new Error('Authentication required'));
        }
        
        try {
            const decoded = this.validateToken(authHeader);
            socket.decodedToken = decoded;
            next();
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AuthMiddleware;