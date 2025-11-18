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
            return jwt.verify(token, this.secretKey, {
                issuer: 'servicedesk-server',
                audience: 'servicedesk-client',
                algorithms: ['HS256'], // Explicit algorithm whitelisting
                clockTolerance: 10
            });
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
        // Required fields - use strict null/undefined checks
        const required = ['user_id', 'connection_id', 'exp', 'iat'];
        
        for (const field of required) {
            if (payload[field] === undefined || payload[field] === null) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Check token expiration (jwt.verify already checks this, but double-check)
        if (this.isTokenExpired(payload)) {
            throw new Error('Token expired');
        }

        // Validate user_id is a number (allow 0 as valid user ID)
        if (!Number.isInteger(payload.user_id) || payload.user_id < 0) {
            throw new Error('Invalid user_id: must be a non-negative integer');
        }

        // Validate connection_id format
        if (typeof payload.connection_id !== 'string' || !payload.connection_id.trim()) {
            throw new Error('Invalid connection_id: must be a non-empty string');
        }

        // Validate timestamps with clock skew tolerance
        const now = Math.floor(Date.now() / 1000);
        const clockSkew = 10; // 10 seconds tolerance
        
        if (payload.iat > now + clockSkew) {
            throw new Error('Token issued in the future');
        }

        // Note: nbf (not before) is now handled by jwt.verify() with clockTolerance
        // but we keep this check for extra safety
        if (payload.nbf && payload.nbf > now + clockSkew) {
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

        const crypto = require('crypto');
        const now = Math.floor(Date.now() / 1000);
        
        const payload = {
            // User-specific claims
            user_id: parseInt(userId),
            connection_id: connectionId,
            session_id: 'test_session_' + Date.now(),
            user_agent_hash: 'test_ua_hash',
            ip_hash: 'test_ip_hash',
            jti: crypto.randomBytes(16).toString('hex'), // Unique JWT ID
            
            // Merge additional claims
            ...additionalClaims
        };

        return jwt.sign(payload, this.secretKey, {
            issuer: 'servicedesk-server',
            audience: 'servicedesk-client',
            expiresIn: expirationHours + 'h',
            notBefore: 0
        });
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
            console.error('❌ [JWT-AUTH] No token provided');
            throw new Error('No token provided');
        }

        const debugMode = process.env.DEBUG_MODE === 'true';
        if (debugMode) {
            console.log('🔐 [JWT-AUTH] Starting token authentication');
            console.log(`📏 [JWT-AUTH] Token length: ${token.length} characters`);
            console.log(`📄 [JWT-AUTH] Token preview: ${token.substring(0, 50)}...`);
        }

        try {
            // Verify and decode token
            if (debugMode) console.log('🔍 [JWT-AUTH] Verifying token signature and claims...');
            const payload = this.verifyToken(token);
            if (debugMode) {
                console.log('✅ [JWT-AUTH] Token signature valid');
                console.log('✅ [JWT-AUTH] Issuer/Audience validated');
                console.log(`👤 [JWT-AUTH] User ID: ${payload.user_id}`);
                console.log(`🔗 [JWT-AUTH] Connection ID: ${payload.connection_id}`);
            }
            
            // Validate payload structure
            if (debugMode) console.log('🔍 [JWT-AUTH] Validating payload structure...');
            this.validatePayload(payload);
            if (debugMode) console.log('✅ [JWT-AUTH] Payload structure valid');
            
            const expiresAt = new Date(payload.exp * 1000);
            const timeToExpiry = Math.floor((payload.exp * 1000 - Date.now()) / 1000);
            if (debugMode) console.log(`⏰ [JWT-AUTH] Token expires at: ${expiresAt.toISOString()} (in ${timeToExpiry}s)`);

            // Return structured user information
            const authResult = {
                payload,
                userInfo: this.getTokenInfo(payload),
                fingerprint: this.extractFingerprint(payload),
                expiryWarning: this.getExpiryWarningTime(payload)
            };
            
            if (debugMode) console.log('🎉 [JWT-AUTH] Authentication successful');
            return authResult;
            
        } catch (error) {
            if (debugMode) console.error('❌ [JWT-AUTH] Authentication failed:', error.message);
            
            // Provide more specific error messages
            if (debugMode) {
                if (error.message.includes('jwt expired')) {
                    console.error('⏰ [JWT-AUTH] TOKEN EXPIRED');
                } else if (error.message.includes('invalid signature')) {
                    console.error('🔐 [JWT-AUTH] INVALID SIGNATURE');
                } else if (error.message.includes('jwt malformed')) {
                    console.error('📄 [JWT-AUTH] MALFORMED TOKEN');
                } else if (error.message.includes('invalid issuer')) {
                    console.error('🏢 [JWT-AUTH] INVALID ISSUER');
                } else if (error.message.includes('invalid audience')) {
                    console.error('🎯 [JWT-AUTH] INVALID AUDIENCE');
                }
            }
            
            throw error;
        }
    }
}

module.exports = JwtHelper;
