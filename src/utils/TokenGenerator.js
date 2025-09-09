/**
 * JWT Token Generator for Testing Socket.IO Authentication
 * 
 * This utility generates valid JWT tokens for testing authentication
 * and debugging connection issues.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class TokenGenerator {
    constructor(secretKey) {
        this.secretKey = secretKey || 'your-super-secret-jwt-key-change-this-in-production';
    }

    /**
     * Generate a connection-specific JWT token
     */
    generateConnectionToken(userId, username, options = {}) {
        const connectionId = options.connectionId || this.generateConnectionId();
        const expiresIn = options.expiresIn || '1h';
        const isAdmin = options.isAdmin || false;
        const fullName = options.fullName || `User ${userId}`;

        const payload = {
            user_id: userId,
            connection_id: connectionId,
            username: username,
            full_name: fullName,
            is_admin: isAdmin,
            created_at: new Date().toISOString()
        };

        const token = jwt.sign(payload, this.secretKey, {
            expiresIn,
            issuer: 'servicedesk-server',
            audience: 'servicedesk-client'
        });

        return {
            token,
            payload,
            expires_in: expiresIn,
            created_at: payload.created_at
        };
    }

    /**
     * Generate a unique connection ID
     */
    generateConnectionId() {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Verify a token (for testing)
     */
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.secretKey);
            return { valid: true, payload: decoded };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Generate multiple test tokens
     */
    generateTestTokens() {
        const tokens = [];

        // Valid token
        tokens.push({
            name: 'Valid Token (1 hour)',
            ...this.generateConnectionToken('user123', 'testuser', { 
                fullName: 'Test User',
                expiresIn: '1h' 
            })
        });

        // Short-lived token (for expiration testing)
        tokens.push({
            name: 'Short-lived Token (10 seconds)',
            ...this.generateConnectionToken('user456', 'shortuser', { 
                fullName: 'Short User',
                expiresIn: '10s' 
            })
        });

        // Admin token
        tokens.push({
            name: 'Admin Token',
            ...this.generateConnectionToken('admin1', 'adminuser', { 
                fullName: 'Admin User',
                isAdmin: true,
                expiresIn: '2h' 
            })
        });

        // Already expired token (for error testing)
        try {
            const expiredToken = jwt.sign({
                user_id: 'expired_user',
                connection_id: this.generateConnectionId(),
                username: 'expireduser',
                full_name: 'Expired User',
                is_admin: false,
                created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
            }, this.secretKey, {
                expiresIn: '-1h', // Already expired
                issuer: 'servicedesk-server',
                audience: 'servicedesk-client'
            });

            tokens.push({
                name: 'Expired Token (for error testing)',
                token: expiredToken,
                payload: { note: 'This token is already expired' },
                expires_in: '-1h',
                created_at: new Date(Date.now() - 3600000).toISOString()
            });
        } catch (error) {
            console.log('Note: Could not create expired token for testing');
        }

        return tokens;
    }

    /**
     * Print test tokens for easy copy-paste
     */
    printTestTokens() {
        const tokens = this.generateTestTokens();

        console.log('\n🎫 Generated Test JWT Tokens for Socket.IO Authentication:');
        console.log('=' .repeat(80));

        tokens.forEach((tokenInfo, index) => {
            console.log(`\n${index + 1}. ${tokenInfo.name}`);
            console.log('   Token:');
            console.log(`   ${tokenInfo.token}`);
            console.log(`   User ID: ${tokenInfo.payload.user_id || 'N/A'}`);
            console.log(`   Username: ${tokenInfo.payload.username || 'N/A'}`);
            console.log(`   Connection ID: ${tokenInfo.payload.connection_id || 'N/A'}`);
            console.log(`   Expires: ${tokenInfo.expires_in}`);
            console.log(`   Created: ${tokenInfo.created_at}`);
            
            // Show verification
            const verification = this.verifyToken(tokenInfo.token);
            console.log(`   Valid: ${verification.valid ? '✅ YES' : '❌ NO'}`);
            if (!verification.valid) {
                console.log(`   Error: ${verification.error}`);
            }
        });

        console.log('\n💡 Usage in Socket.IO client:');
        console.log('   const socket = io("http://localhost:3001", {');
        console.log('       auth: { token: "PASTE_TOKEN_HERE" }');
        console.log('   });');
        console.log('\n');
    }
}

/**
 * CLI Usage
 */
if (require.main === module) {
    // Load config for secret key
    try {
        const config = require('./config.js');
        const generator = new TokenGenerator(config.jwt.secret);
        generator.printTestTokens();
    } catch (error) {
        console.log('Using default secret key (config not available)');
        const generator = new TokenGenerator();
        generator.printTestTokens();
    }
}

module.exports = TokenGenerator;
