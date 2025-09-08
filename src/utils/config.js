/**
 * Configuration Module for ServiceDesk Socket.IO Server
 * 
 * This module loads and validates environment configuration
 * with proper defaults and type conversion.
 */

const path = require('path');

// Load environment variables from .env file
require('dotenv').config({
    path: path.resolve(__dirname, '../../.env')
});

/**
 * Parse boolean environment variable
 * @param {string} value - Environment variable value
 * @param {boolean} defaultValue - Default value if not set
 * @returns {boolean}
 */
const parseBoolean = (value, defaultValue = false) => {
    if (value === undefined || value === null) return defaultValue;
    return value.toLowerCase() === 'true';
};

/**
 * Parse integer environment variable
 * @param {string} value - Environment variable value
 * @param {number} defaultValue - Default value if not set
 * @returns {number}
 */
const parseInteger = (value, defaultValue = 0) => {
    if (value === undefined || value === null) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Parse CORS origins (supports comma-separated list)
 * @param {string} value - Environment variable value
 * @returns {string|array}
 */
const parseCorsOrigins = (value) => {
    if (!value || value === '*') return '*';
    return value.split(',').map(origin => origin.trim());
};

/**
 * Validate required environment variables
 */
const validateConfig = (config) => {
    const errors = [];
    
    if (!config.jwt.secret || config.jwt.secret === 'your-super-secret-jwt-key-change-this-in-production') {
        if (config.server.nodeEnv === 'production') {
            errors.push('JWT_SECRET must be set to a secure value in production');
        } else {
            console.warn('⚠️ WARNING: Using default JWT secret. Set JWT_SECRET environment variable.');
        }
    }
    
    if (config.server.useHttps) {
        if (!config.ssl.certPath || !config.ssl.keyPath) {
            errors.push('SSL_CERT_PATH and SSL_KEY_PATH must be set when USE_HTTPS=true');
        }
    }
    
    if (errors.length > 0) {
        console.error('❌ Configuration errors:');
        errors.forEach(error => console.error(`  - ${error}`));
        process.exit(1);
    }
};

// Main configuration object
const config = {
    server: {
        port: parseInteger(process.env.PORT, 3000),
        nodeEnv: process.env.NODE_ENV || 'development',
        useHttps: parseBoolean(process.env.USE_HTTPS, false),
        debugMode: parseBoolean(process.env.DEBUG_MODE, false),
        enableAdminEndpoints: parseBoolean(process.env.ENABLE_ADMIN_ENDPOINTS, false)
    },
    
    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'
    },
    
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInteger(process.env.REDIS_PORT, 6379),
        password: process.env.REDIS_PASSWORD || null,
        db: parseInteger(process.env.REDIS_DB, 0)
    },
    
    cors: {
        origin: parseCorsOrigins(process.env.CORS_ORIGIN || '*'),
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    },
    
    ssl: {
        certPath: process.env.SSL_CERT_PATH || './config/ssl/certificate.crt',
        keyPath: process.env.SSL_KEY_PATH || './config/ssl/private.key'
    },
    
    socketIo: {
        pingTimeout: parseInteger(process.env.PING_TIMEOUT, 60000),
        pingInterval: parseInteger(process.env.PING_INTERVAL, 25000),
        maxHttpBufferSize: parseInteger(process.env.MAX_HTTP_BUFFER_SIZE, 1048576),
        enableCompression: parseBoolean(process.env.ENABLE_COMPRESSION, true),
        authTimeout: parseInteger(process.env.AUTH_TIMEOUT, 30000)
    },
    
    security: {
        maxConnectionsPerUser: parseInteger(process.env.MAX_CONNECTIONS_PER_USER, 0),
        authRateLimit: parseInteger(process.env.AUTH_RATE_LIMIT, 10),
        connectionHistorySize: parseInteger(process.env.CONNECTION_HISTORY_SIZE, 100)
    },
    
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        debugMode: parseBoolean(process.env.DEBUG_MODE, false)
    }
};

// Add legacy support for existing config structure
config.server.sslCertificate = config.ssl.certPath;
config.server.ssLCertificateKey = config.ssl.keyPath;
config.socketIo.corsOrigin = config.cors.origin;
config.socketIo.corsMethods = config.cors.methods;

// Validate configuration
validateConfig(config);

// Log configuration summary (without sensitive data)
const configSummary = {
    server: {
        port: config.server.port,
        nodeEnv: config.server.nodeEnv,
        useHttps: config.server.useHttps,
        debugMode: config.server.debugMode
    },
    redis: {
        host: config.redis.host,
        port: config.redis.port,
        hasPassword: !!config.redis.password
    },
    cors: {
        origin: config.cors.origin
    },
    jwt: {
        configured: !!config.jwt.secret
    }
};

if (config.server.debugMode) {
    console.log('🔧 Configuration loaded:', JSON.stringify(configSummary, null, 2));
}

module.exports = config;