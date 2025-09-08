/**
 * JWT Helper for Connection-Specific Tokens
 * 
 * This class handles the creation, validation, and management of connection-specific
 * JWT tokens for secure Socket.IO authentication.
 */

const jwt = require('jsonwebtoken');

class JwtHelper {
    constructor(secretKey) {
        if (!secretKey) {
            throw new Error('JWT secret key is required');
        }
        this.secretKey = secretKey;
    }

    /**
     * Verify and decode JWT token
     * 
     * @param {string} token - JWT token to verify
     * @returns {object} Decoded payload
     * @throws {Error} If token is invalid
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.secretKey);
        } catch (error) {
            throw new Error(`JWT verification failed: ${error.message}`);
        }
    }

    /**
     * Check if token is expired
     * 
     * @param {object} payload - Decoded JWT payload
     * @returns {boolean} True if token is expired
     */
    isTokenExpired(payload) {
        return payload.exp && payload.exp < Math.floor(Date.now() / 1000);
    }

    /**
     * Validate token payload structure and claims
     * 
     * @param {object} payload - Decoded JWT payload
     * @returns {boolean} True if payload is valid
     * @throws {Error} If payload is invalid
     */
    validatePayload(payload) {
        const required = ['user_id', 'connection_id', 'exp', 'iat', 'jti'];
        
        for (const field of required) {
            if (!payload[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Check token expiration
        if (this.isTokenExpired(payload)) {
            throw new Error('Token expired');
        }

        // Validate user_id is a number
        if (!Number.isInteger(payload.user_id) || payload.user_id <= 0) {
            throw new Error('Invalid user_id');
        }

        // Validate connection_id format
        if (typeof payload.connection_id !== 'string' || !payload.connection_id.trim()) {
            throw new Error('Invalid connection_id');
        }

        // Validate timestamps
        if (payload.iat > Math.floor(Date.now() / 1000)) {
            throw new Error('Token issued in the future');
        }

        if (payload.nbf && payload.nbf > Math.floor(Date.now() / 1000)) {
            throw new Error('Token not yet valid');
        }

        return true;
    }

    /**
     * Extract connection fingerprint information from payload
     * 
     * @param {object} payload - Decoded JWT payload
     * @returns {object} Fingerprint information
     */
    extractFingerprint(payload) {
        return {
            userAgentHash: payload.user_agent_hash || null,
            ipHash: payload.ip_hash || null,
            sessionId: payload.session_id || null
        };
    }

    /**
     * Get token expiry warning time
     * 
     * @param {object} payload - Decoded JWT payload
     * @param {number} warningSeconds - Seconds before expiry to warn (default: 300)
     * @returns {number|null} Timestamp when to show warning, or null if already passed
     */
    getExpiryWarningTime(payload, warningSeconds = 300) {
        if (!payload.exp) {
            return null;
        }

        const warningTime = (payload.exp - warningSeconds) * 1000;
        const now = Date.now();

        return warningTime > now ? warningTime : null;
    }

    /**
     * Create JWT payload for testing (not used in production)
     * This should only be used for development/testing purposes
     * 
     * @param {number} userId - User ID
     * @param {string} connectionId - Connection ID
     * @param {object} additionalClaims - Additional claims to include
     * @param {number} expirationHours - Token validity in hours
     * @returns {string} JWT token
     */
    createTestToken(userId, connectionId, additionalClaims = {}, expirationHours = 24) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Test token creation not allowed in production');
        }

        const now = Math.floor(Date.now() / 1000);
        
        const payload = {
            iss: 'servicedesk-test',
            aud: 'socket.io',
            iat: now,
            exp: now + (expirationHours * 3600),
            nbf: now,
            jti: connectionId,
            
            // User-specific claims
            user_id: parseInt(userId),
            connection_id: connectionId,
            session_id: 'test_session_' + Date.now(),
            user_agent_hash: 'test_ua_hash',
            ip_hash: 'test_ip_hash',
            
            // Merge additional claims
            ...additionalClaims
        };

        return jwt.sign(payload, this.secretKey);
    }

    /**
     * Get human-readable token information
     * 
     * @param {object} payload - Decoded JWT payload
     * @returns {object} Human-readable token information
     */
    getTokenInfo(payload) {
        return {
            userId: payload.user_id,
            connectionId: payload.connection_id,
            username: payload.username || null,
            fullName: payload.full_name || null,
            isAdmin: payload.is_admin || false,
            groups: payload.groups || [],
            permissions: payload.permissions || {},
            issuedAt: new Date(payload.iat * 1000).toISOString(),
            expiresAt: new Date(payload.exp * 1000).toISOString(),
            issuer: payload.iss || 'unknown',
            audience: payload.aud || 'unknown'
        };
    }

    /**
     * Validate token and return user information
     * This is the main method to use for authentication
     * 
     * @param {string} token - JWT token to validate
     * @returns {object} User and connection information
     * @throws {Error} If token is invalid
     */
    authenticateToken(token) {
        if (!token) {
            throw new Error('No token provided');
        }

        // Verify and decode token
        const payload = this.verifyToken(token);
        
        // Validate payload structure
        this.validatePayload(payload);

        // Return structured user information
        return {
            payload,
            userInfo: this.getTokenInfo(payload),
            fingerprint: this.extractFingerprint(payload),
            expiryWarning: this.getExpiryWarningTime(payload)
        };
    }
}

module.exports = JwtHelper;
