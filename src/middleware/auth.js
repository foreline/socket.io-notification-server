/*
 * Authentication middleware for connection-specific JWT tokens
 */

const JwtHelper = require('../utils/JwtHelper');

class AuthMiddleware {
    constructor(secretKey, authDebugger = null) {
        if (!secretKey) {
            throw new Error('JWT secret key is required for authentication middleware');
        }
        
        this.jwtHelper = new JwtHelper(secretKey);
        this.secretKey = secretKey;
        this.authDebugger = authDebugger;
    }
    
    /**
     * Validate connection-specific JWT token
     * 
     * @param {string} token - JWT token to validate
     * @returns {object} Authentication result with user info
     * @throws {Error} If token is invalid
     */
    validateToken(token) {
        try {
            return this.jwtHelper.authenticateToken(token);
        } catch (error) {
            throw new Error(`Token validation failed: ${error.message}`);
        }
    }
    
    /**
     * Socket.IO authentication middleware handler
     * 
     * @param {object} socket - Socket.IO socket instance
     * @param {function} next - Next middleware function
     * @returns {*}
     */
    handle(socket, next) {
        try {
            // Extract token strictly from auth payload (query tokens deprecated for security)
            const token = socket.handshake.auth?.token;
            
            // Debug authentication start
            if (this.authDebugger) {
                this.authDebugger.logAuthStart(socket, token);
            }
            
            if (!token) {
                const error = new Error('Authentication required: No token provided (use auth.token, query tokens disabled)');
                error.data = { 
                    code: 'NO_TOKEN',
                    timestamp: new Date().toISOString(),
                    clientIP: socket.handshake.address,
                    userAgent: socket.handshake.headers['user-agent']
                };
                
                console.log(`❌ [AUTH-NO-TOKEN] Socket ${socket.id} from ${socket.handshake.address}`);
                return next(error);
            }
            
            // Validate the connection-specific JWT token
            let authResult;
            try {
                authResult = this.validateToken(token);
                
                // Debug successful validation
                if (this.authDebugger) {
                    this.authDebugger.logTokenValidation(socket, token, authResult, null);
                }
            } catch (validationError) {
                // Debug failed validation
                if (this.authDebugger) {
                    this.authDebugger.logTokenValidation(socket, token, null, validationError);
                }
                throw validationError;
            }
            
            // Store authentication information in socket
            socket.authResult = authResult;
            socket.tokenPayload = authResult.payload;
            socket.userInfo = authResult.userInfo;
            
            // Log successful authentication
            console.log(`🔐 Authentication successful for user ${authResult.userInfo.userId}, connection ${authResult.userInfo.connectionId}`);
            
            // Continue to next middleware
            next();
            
        } catch (error) {
            // Log authentication failure
            console.error(`❌ Authentication failed for socket ${socket.id}: ${error.message}`);
            
            // Create detailed error for client
            const authError = new Error(`Authentication failed: ${error.message}`);
            authError.data = {
                code: 'AUTH_FAILED',
                timestamp: new Date().toISOString(),
                socketId: socket.id,
                reason: error.message,
                clientIP: socket.handshake.address
            };
            
            next(authError);
        }
    }
    
    /**
     * Express middleware for HTTP endpoints (if needed)
     * 
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     * @param {function} next - Next middleware function
     */
    httpMiddleware(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    error: 'Authentication required',
                    code: 'NO_TOKEN',
                    timestamp: new Date().toISOString()
                });
            }
            
            const token = authHeader.substring(7); // Remove 'Bearer ' prefix
            const authResult = this.validateToken(token);
            
            // Store authentication information in request
            req.authResult = authResult;
            req.tokenPayload = authResult.payload;
            req.userInfo = authResult.userInfo;
            
            next();
            
        } catch (error) {
            return res.status(401).json({
                error: 'Authentication failed',
                code: 'AUTH_FAILED',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    /**
     * Get JWT helper instance (for advanced usage)
     * 
     * @returns {JwtHelper} JWT helper instance
     */
    getJwtHelper() {
        return this.jwtHelper;
    }
}

module.exports = AuthMiddleware;