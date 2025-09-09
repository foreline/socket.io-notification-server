/**
 * Socket.IO Server for Connection-Specific Authentication
 * 
 * This server handles connection-specific JWT authenticatio            // Register connection with manager
            const registrationResult = connectionManager.registerConnection(socket, payload);
            
            // Debug connection registration
            if (socketDebugger) {
                socketDebugger.logConnectionRegistration(socket, registrationResult);
            }
            
            if (!registrationResult.success) {
                throw new Error('Failed to register connection');
            }real-time notifications
 * for the ServiceDesk system. Each browser tab gets a unique room based on their
 * connection-specific token.
 */

const fs = require('node:fs');
const express = require('express');
const http = require('http');
const https = require('https');
const cors = require('cors');

// Import utilities and middleware
const config = require('./utils/config.js');
const LoggerMiddleware = require('./middleware/logger.js');
const AuthMiddleware = require('./middleware/auth.js');
const ConnectionManager = require('./utils/ConnectionManager.js');
const SocketIODebugger = require('./utils/SocketIODebugger.js');

// Initialize core components
const app = express();
const logger = new LoggerMiddleware();
const connectionManager = new ConnectionManager();
const socketDebugger = new SocketIODebugger();

// Configuration
const serverConfig = {
    port: config.server.port,
    jwtSecret: config.jwt.secret,
    useHttps: config.server.useHttps,
    cors: config.cors
};

// Validate required configuration
if (!serverConfig.jwtSecret || serverConfig.jwtSecret === 'your-super-secret-jwt-key-change-this-in-production') {
    if (config.server.nodeEnv === 'production') {
        console.error('❌ JWT_SECRET must be set to a secure value in production');
        process.exit(1);
    } else {
        console.warn('⚠️ WARNING: Using default JWT secret! Set JWT_SECRET environment variable.');
    }
}

// Initialize authentication middleware
const authMiddleware = new AuthMiddleware(serverConfig.jwtSecret, socketDebugger);

// Create HTTP/HTTPS server based on configuration
let server;
if (serverConfig.useHttps) {
    try {
        // Check if SSL files exist
        if (!fs.existsSync(config.ssl.certPath)) {
            throw new Error(`SSL certificate not found: ${config.ssl.certPath}`);
        }
        if (!fs.existsSync(config.ssl.keyPath)) {
            throw new Error(`SSL private key not found: ${config.ssl.keyPath}`);
        }
        
        const options = {
            cert: fs.readFileSync(config.ssl.certPath),
            key: fs.readFileSync(config.ssl.keyPath),
        };
        server = https.createServer(options, app);
        console.log('🔒 HTTPS server configured');
        console.log(`   Certificate: ${config.ssl.certPath}`);
        console.log(`   Private Key: ${config.ssl.keyPath}`);
    } catch (error) {
        console.error('❌ HTTPS configuration failed:', error.message);
        console.log('📋 Falling back to HTTP server');
        console.log('💡 To fix HTTPS:');
        console.log('   1. Set USE_HTTPS=false in config/.env for HTTP only');
        console.log('   2. Or provide valid SSL certificates in SSL_CERT_PATH and SSL_KEY_PATH');
        server = http.createServer(app);
    }
} else {
    server = http.createServer(app);
    console.log('🌐 HTTP server configured');
    if (config.server.nodeEnv === 'production') {
        console.warn('⚠️ WARNING: Running HTTP in production! Consider enabling HTTPS.');
        console.log('💡 To enable HTTPS:');
        console.log('   1. Set USE_HTTPS=true in config/.env');
        console.log('   2. Configure SSL_CERT_PATH and SSL_KEY_PATH');
    }
}

// Initialize Socket.IO
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: serverConfig.cors,
    transports: ['websocket', 'polling'],
    pingTimeout: config.socketIo.pingTimeout,
    pingInterval: config.socketIo.pingInterval,
    upgradeTimeout: 10000,
    maxHttpBufferSize: config.socketIo.maxHttpBufferSize,
    allowEIO3: true
});

// Import and setup Socket.IO with Redis
const setupSocketIO = require('./socket.js');
setupSocketIO(io, logger, connectionManager);

// Express middleware
app.use(cors(serverConfig.cors));
app.use(express.json());

// Handle preflight OPTIONS requests explicitly
app.options('*', cors(serverConfig.cors));

/**
 * Apply Authentication Middleware to Socket.IO
 */
io.use((socket, next) => {
    console.log(`🔐 [MIDDLEWARE] Processing authentication for socket ${socket.id}`);
    console.log(`📍 [MIDDLEWARE] Client IP: ${socket.handshake.address}`);
    console.log(`🌐 [MIDDLEWARE] User Agent: ${socket.handshake.headers['user-agent']}`);
    console.log(`🎫 [MIDDLEWARE] Auth token: ${socket.handshake.auth?.token ? 'PROVIDED' : 'MISSING'}`);
    console.log(`🔍 [MIDDLEWARE] Query token: ${socket.handshake.query?.token ? 'PROVIDED' : 'MISSING'}`);
    
    authMiddleware.handle(socket, next);
});

/**
 * Socket.IO Connection Handler with Connection-Specific Authentication
 */
io.on('connection', (socket) => {
    console.log(`🔌 New connection attempt: Socket ${socket.id}`);
    
    // Store connection start time
    socket.connectedAt = new Date();
    
    /**
     * Handle authentication using connection-specific JWT
     */
    const handleAuthentication = async () => {
        try {
            console.log(`🔍 [AUTH-CHECK] Checking authentication for socket ${socket.id}`);
            console.log(`🔍 [AUTH-CHECK] authResult exists: ${!!socket.authResult}`);
            console.log(`🔍 [AUTH-CHECK] tokenPayload exists: ${!!socket.tokenPayload}`);
            
            if (!socket.authResult || !socket.tokenPayload) {
                throw new Error('Socket not properly authenticated by middleware');
            }
            
            console.log(`✅ [AUTH-CHECK] Socket ${socket.id} has valid authentication data`);
            
            const { payload, userInfo } = socket.authResult;
            
            // Set socket properties for connection management
            socket.userId = userInfo.userId;
            socket.connectionId = userInfo.connectionId;
            socket.userInfo = userInfo;
            
            console.log(`🔐 [AUTH-CHECK] User: ${userInfo.userId}, Connection: ${userInfo.connectionId}`);
            
            // Register connection with ConnectionManager
            const registrationResult = connectionManager.registerConnection(socket, payload);
            
            // Debug connection registration
            if (socketDebugger) {
                socketDebugger.logConnectionRegistration(socket, registrationResult);
            }
            
            if (!registrationResult.success) {
                throw new Error(`Connection registration failed: ${registrationResult.error || 'Unknown error'}`);
            }
            
            // Join connection-specific room
            const connectionRoom = connectionManager.getConnectionRoom(payload.connection_id);
            await socket.join(connectionRoom);
            
            // Join user room for broadcast messages
            const userRoom = connectionManager.getUserRoom(payload.user_id);
            await socket.join(userRoom);
            
            console.log(`✅ Socket ${socket.id} joined rooms: ${connectionRoom}, ${userRoom}`);
            
            // Send authentication success response with helpful message
            socket.emit('authenticated', {
                success: true,
                user_id: userInfo.userId,
                connection_id: userInfo.connectionId,
                username: userInfo.username,
                full_name: userInfo.fullName,
                is_admin: userInfo.isAdmin,
                expires_at: userInfo.expiresAt,
                rooms: [connectionRoom, userRoom],
                server_time: new Date().toISOString(),
                connection_count: registrationResult.userConnectionCount,
                message: 'Authentication successful. You are now connected.'
            });
            
            // Set up token expiry warning
            if (socket.authResult.expiryWarning) {
                const warningDelay = socket.authResult.expiryWarning - Date.now();
                
                if (warningDelay > 0) {
                    setTimeout(() => {
                        if (socket.connected) {
                            socket.emit('token_expiring', {
                                expires_at: userInfo.expiresAt,
                                warning_seconds: 300,
                                current_time: new Date().toISOString(),
                                message: 'Your authentication token will expire soon. Please refresh your session.'
                            });
                        }
                    }, warningDelay);
                }
            }
            
            console.log(`🔐 Authentication completed for user ${userInfo.userId}, connection ${userInfo.connectionId}`);
            
            // Debug authentication completion
            if (socketDebugger) {
                socketDebugger.logAuthComplete(socket, true, null);
            }
            
        } catch (error) {
            console.error(`❌ Authentication setup failed for socket ${socket.id}:`, error.message);
            console.error(`❌ Error details:`, {
                hasAuthResult: !!socket.authResult,
                hasTokenPayload: !!socket.tokenPayload,
                errorType: error.constructor.name,
                errorMessage: error.message
            });
            
            // Debug authentication failure
            if (socketDebugger) {
                socketDebugger.logAuthComplete(socket, false, error);
            }
            
            // Determine error type and provide appropriate client message
            let errorCode = 'AUTH_FAILED';
            let clientMessage = 'Authentication failed. Please check your credentials and try again.';
            
            if (error.message.includes('middleware')) {
                errorCode = 'AUTH_MIDDLEWARE_FAILED';
                clientMessage = 'Authentication middleware rejected your connection. Please verify your token and try reconnecting.';
            } else if (error.message.includes('registration')) {
                errorCode = 'CONNECTION_REGISTRATION_FAILED';  
                clientMessage = 'Failed to register your connection. Please try reconnecting.';
            } else if (error.message.includes('Token validation failed')) {
                errorCode = 'TOKEN_VALIDATION_FAILED';
                clientMessage = 'Your authentication token is invalid. Please obtain a new token and try again.';
            }
            
            socket.emit('authentication_failed', {
                error: 'Authentication failed',
                code: errorCode,
                message: clientMessage,
                timestamp: new Date().toISOString(),
                socket_id: socket.id,
                reconnect_suggested: true,
                help: 'If this problem persists, please contact support.'
            });
            
            // Disconnect after delay with detailed logging
            console.log(`⏰ [DISCONNECT-SCHEDULED] Socket ${socket.id} will disconnect in 5 seconds due to auth failure: ${error.message}`);
            setTimeout(() => {
                if (!socket.userId) {
                    console.log(`🔌 [DISCONNECT-EXECUTING] Socket ${socket.id} disconnecting due to authentication failure`);
                    socket.disconnect(true);
                }
            }, 5000);
        }
    };
    
    // Trigger authentication process after middleware has run
    setImmediate(handleAuthentication);
    
    /**
     * Handle manual token refresh
     */
    socket.on('refresh_token', async ({ token }) => {
        try {
            console.log(`🔄 Token refresh requested for socket ${socket.id}`);
            
            // Validate new token
            const authResult = authMiddleware.validateToken(token);
            
            // Update socket authentication info
            socket.authResult = authResult;
            socket.tokenPayload = authResult.payload;
            socket.userInfo = authResult.userInfo;
            
            // Re-run authentication process
            await handleAuthentication();
            
        } catch (error) {
            console.error(`❌ Token refresh failed for socket ${socket.id}:`, error.message);
            
            socket.emit('authentication_failed', {
                error: `Token refresh failed: ${error.message}`,
                timestamp: new Date().toISOString()
            });
        }
    });
    
    /**
     * Handle heartbeat/ping for connection health monitoring
     */
    socket.on('ping', () => {
        socket.emit('pong', {
            timestamp: Date.now(),
            server_time: new Date().toISOString(),
            socket_id: socket.id,
            connection_id: socket.connectionId || null,
            user_id: socket.userId || null
        });
    });
    
    /**
     * Handle custom messages (for compatibility)
     */
    socket.on('message', (data) => {
        if (!socket.userId) {
            return; // Ignore messages from unauthenticated sockets
        }
        
        console.log(`📨 Message from user ${socket.userId}, connection ${socket.connectionId}:`, data);
        
        // Broadcast to all other connections of the same user
        const userSockets = connectionManager.getUserConnections(socket.userId);
        userSockets.forEach(userSocket => {
            if (userSocket.id !== socket.id) {
                userSocket.emit('user_message', {
                    sender_connection_id: socket.connectionId,
                    sender_socket_id: socket.id,
                    message: data,
                    timestamp: new Date().toISOString()
                });
            }
        });
    });
    
    /**
     * Handle connection errors
     */
    socket.on('error', (error) => {
        console.error(`❌ Socket error for ${socket.id}:`, error);
        
        const logEntry = logger.generateLogEntry(
            'socket_error',
            socket.userId || null,
            'Socket connection error',
            { 
                error: error.message,
                socket_id: socket.id,
                connection_id: socket.connectionId || null
            }
        );
        console.error(JSON.stringify(logEntry));
    });
    
    /**
     * Handle disconnection
     */
    socket.on('disconnect', (reason) => {
        const connectedDuration = Date.now() - socket.connectedAt.getTime();
        
        // Debug disconnection
        if (socketDebugger) {
            socketDebugger.logDisconnection(socket, reason);
        }
        
        console.log(`🔌 Socket ${socket.id} disconnected: ${reason} (connected for ${connectedDuration}ms)`);
        
        // Unregister connection
        const unregResult = connectionManager.unregisterConnection(socket);
        
        // Log disconnection
        const logEntry = logger.generateLogEntry(
            'socket_disconnect',
            socket.userId || null,
            `Socket disconnected: ${reason}`,
            {
                socket_id: socket.id,
                connection_id: socket.connectionId || null,
                reason,
                connected_duration_ms: connectedDuration,
                remaining_user_connections: unregResult.remainingUserConnections || 0,
                was_authenticated: !!socket.userId
            }
        );
        console.log(JSON.stringify(logEntry));
    });
    
    // Auto-disconnect unauthenticated connections after timeout
    setTimeout(() => {
        if (!socket.userId) {
            console.log(`⏰ [DISCONNECT-TIMEOUT] Socket ${socket.id} disconnecting after ${config.socketIo.authTimeout}ms timeout (unauthenticated)`);
            socket.disconnect(true);
        }
    }, config.socketIo.authTimeout);
});

// Periodic debugging summary (every 30 seconds)
setInterval(() => {
    if (socketDebugger) {
        socketDebugger.printSummary();
    }
}, 30000);

/**
 * Express Routes for Health Checks and Management
 */

// Health check endpoint
app.get('/health', (req, res) => {
    const stats = connectionManager.getStats();
    
    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: {
            uptime_seconds: process.uptime(),
            memory_usage: process.memoryUsage(),
            pid: process.pid,
            node_version: process.version,
            environment: config.server.nodeEnv || 'development'
        },
        connections: {
            total: stats.totalConnections,
            users: stats.totalUsers,
            total_ever: stats.totalConnectionsEver,
            average_per_user: stats.averageConnectionsPerUser
        },
        configuration: {
            port: serverConfig.port,
            https_enabled: serverConfig.useHttps,
            cors_origin: serverConfig.cors.origin,
            jwt_configured: !!serverConfig.jwtSecret
        }
    };
    
    // Log health check
    const logEntry = logger.generateLogEntry(
        'health_check',
        null,
        'Health check performed',
        { response_data: healthData }
    );
    console.log(JSON.stringify(logEntry));
    
    res.json(healthData);
});

// Detailed connection statistics endpoint
app.get('/stats', (req, res) => {
    const stats = connectionManager.getStats();
    
    res.json({
        timestamp: new Date().toISOString(),
        ...stats
    });
});

// Active users summary endpoint
app.get('/users', (req, res) => {
    const activeUsers = connectionManager.getActiveUsersSummary();
    
    res.json({
        timestamp: new Date().toISOString(),
        total_active_users: activeUsers.length,
        users: activeUsers
    });
});

// Connection cleanup endpoint (admin only in production)
app.post('/admin/cleanup', (req, res) => {
    if (config.server.nodeEnv === 'production' && !config.server.enableAdminEndpoints) {
        return res.status(403).json({ error: 'Admin endpoints disabled in production' });
    }
    
    const cleanedUp = connectionManager.cleanupStaleConnections();
    
    res.json({
        message: 'Cleanup completed',
        connections_cleaned: cleanedUp,
        timestamp: new Date().toISOString()
    });
});

/**
 * Error Handlers
 */

// Global error handler
app.use((error, req, res, next) => {
    console.error('❌ Express error:', error);
    
    res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        ...(config.server.nodeEnv !== 'production' && { details: error.message })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

// Process error handling
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📤 SIGTERM received, shutting down gracefully');
    
    server.close(() => {
        console.log('🔌 Server closed');
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('📤 SIGINT received, shutting down gracefully');
    
    server.close(() => {
        console.log('🔌 Server closed');
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    });
});

/**
 * Start Server
 */
server.listen(serverConfig.port, () => {
    console.log(`🚀 Socket.IO server running on port ${serverConfig.port}`);
    console.log(`🔐 JWT authentication configured`);
    console.log(`🌐 CORS Origin: ${serverConfig.cors.origin}`);
    console.log(`🔒 HTTPS: ${serverConfig.useHttps ? 'Enabled' : 'Disabled'}`);
    console.log(`🎯 Ready for connection-specific authentication!`);
    
    // Log startup
    const logEntry = logger.generateLogEntry(
        'server_start',
        null,
        'Socket.IO server started',
        {
            port: serverConfig.port,
            https: serverConfig.useHttps,
            environment: config.server.nodeEnv || 'development'
        }
    );
    console.log(JSON.stringify(logEntry));
});