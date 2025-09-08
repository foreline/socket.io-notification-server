/**
 * Socket.IO Configuration with Redis Adapter and Notification Handling
 * 
 * This module sets up the Redis adapter for Socket.IO and handles
 * Redis pub/sub for connection-specific notifications.
 */

const Redis = require("ioredis");
const { createAdapter } = require("@socket.io/redis-adapter");

// Import configuration
const config = require('./utils/config.js');

// Create Redis clients for Socket.IO adapter
const pubClient = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
});

const subClient = pubClient.duplicate();

// Create separate Redis clients for notification pub/sub
const notificationSubscriber = pubClient.duplicate();

// Handle Redis connection events
const setupRedisEventHandlers = (client, name) => {
    client.on('connect', () => {
        console.log(`📡 ${name} Redis client connected`);
    });
    
    client.on('ready', () => {
        console.log(`✅ ${name} Redis client ready`);
    });
    
    client.on('error', (err) => {
        console.error(`❌ ${name} Redis client error:`, err);
    });
    
    client.on('close', () => {
        console.log(`🔌 ${name} Redis client connection closed`);
    });
    
    client.on('reconnecting', () => {
        console.log(`🔄 ${name} Redis client reconnecting...`);
    });
};

// Setup event handlers for all Redis clients
setupRedisEventHandlers(pubClient, 'PubClient');
setupRedisEventHandlers(subClient, 'SubClient');
setupRedisEventHandlers(notificationSubscriber, 'NotificationSubscriber');

// Create Redis adapter for Socket.IO
const redisAdapter = createAdapter(pubClient, subClient, {
    key: 'socket.io',
    requestsTimeout: 5000,
});

/**
 * Setup Socket.IO with Redis adapter and notification handling
 * 
 * @param {object} io - Socket.IO server instance
 * @param {object} logger - Logger middleware instance
 * @param {object} connectionManager - Connection manager instance
 */
module.exports = (io, logger, connectionManager) => {
    
    // Configure Socket.IO with Redis adapter
    io.adapter(redisAdapter);
    
    console.log('🔧 Socket.IO configured with Redis adapter');
    
    /**
     * Redis Notification Message Handlers
     */
    
    /**
     * Handle user notifications (send to all user's connections)
     */
    const handleUserNotifications = (channel, message) => {
        try {
            const payload = JSON.parse(message);
            
            if (payload.type === 'user_notification' && payload.target_user_id) {
                const userId = payload.target_user_id;
                const userSockets = connectionManager.getUserConnections(userId);
                
                console.log(`📨 Sending notification to user ${userId} (${userSockets.length} connections)`);
                
                // Send to all user's connections
                userSockets.forEach(socket => {
                    socket.emit('notification', {
                        ...payload.notification,
                        delivered_to_connection: socket.connectionId,
                        delivered_at: new Date().toISOString(),
                        delivery_method: 'user_broadcast'
                    });
                });
                
                // Log delivery stats
                const logEntry = logger.generateLogEntry(
                    'notification_delivered',
                    userId,
                    `User notification delivered to ${userSockets.length} connections`,
                    {
                        notification_type: payload.notification?.type || 'unknown',
                        connections_count: userSockets.length,
                        target_user_id: userId
                    }
                );
                console.log(JSON.stringify(logEntry));
                
            } else {
                console.warn('⚠️ Invalid user notification payload:', payload);
            }
        } catch (error) {
            console.error('❌ Error processing user notification:', error);
        }
    };
    
    /**
     * Handle connection-specific notifications
     */
    const handleConnectionNotifications = (channel, message) => {
        try {
            const payload = JSON.parse(message);
            
            if (payload.type === 'connection_notification' && payload.target_connection_id) {
                const connectionId = payload.target_connection_id;
                const socket = connectionManager.getConnection(connectionId);
                
                if (socket && socket.connected) {
                    socket.emit('notification', {
                        ...payload.notification,
                        delivered_to_connection: connectionId,
                        delivered_at: new Date().toISOString(),
                        delivery_method: 'connection_specific'
                    });
                    
                    const logEntry = logger.generateLogEntry(
                        'notification_delivered',
                        socket.userId || null,
                        'Connection-specific notification delivered',
                        {
                            notification_type: payload.notification?.type || 'unknown',
                            target_connection_id: connectionId,
                            socket_id: socket.id
                        }
                    );
                    console.log(JSON.stringify(logEntry));
                    
                } else {
                    console.log(`⚠️ Connection ${connectionId} not found or disconnected`);
                }
                
            } else {
                console.warn('⚠️ Invalid connection notification payload:', payload);
            }
        } catch (error) {
            console.error('❌ Error processing connection notification:', error);
        }
    };
    
    /**
     * Handle broadcast notifications (send to all connected users)
     */
    const handleBroadcastNotifications = (channel, message) => {
        try {
            const payload = JSON.parse(message);
            
            if (payload.type === 'broadcast') {
                const allConnections = connectionManager.getAllConnections();
                
                console.log(`📢 Broadcasting notification to ${allConnections.length} connections`);
                
                // Send to all connected sockets
                allConnections.forEach(socket => {
                    socket.emit('notification', {
                        ...payload.notification,
                        delivered_to_connection: socket.connectionId,
                        delivered_at: new Date().toISOString(),
                        delivery_method: 'broadcast',
                        is_broadcast: true
                    });
                });
                
                const logEntry = logger.generateLogEntry(
                    'notification_broadcast',
                    null,
                    `Broadcast notification sent to ${allConnections.length} connections`,
                    {
                        notification_type: payload.notification?.type || 'unknown',
                        connections_count: allConnections.length
                    }
                );
                console.log(JSON.stringify(logEntry));
                
            } else {
                console.warn('⚠️ Invalid broadcast notification payload:', payload);
            }
        } catch (error) {
            console.error('❌ Error processing broadcast notification:', error);
        }
    };
    
    /**
     * Handle legacy socket.io-response channel (for backwards compatibility)
     */
    const handleLegacyMessages = (channel, message) => {
        try {
            console.log('📨 Legacy message received on channel:', channel);
            
            let parsedMessage;
            if (typeof message === 'object') {
                parsedMessage = message;
            } else {
                parsedMessage = JSON.parse(message);
            }
            
            // Broadcast as legacy format
            io.emit('broadcast', {
                sender: 'server',
                message: parsedMessage,
                timestamp: new Date().toISOString(),
                channel: channel
            });
            
            const logEntry = logger.generateLogEntry(
                'legacy_message_broadcast',
                null,
                'Legacy message broadcasted',
                { channel, message: parsedMessage }
            );
            console.log(JSON.stringify(logEntry));
            
        } catch (error) {
            console.error('❌ Error processing legacy message:', error);
        }
    };
    
    /**
     * Subscribe to notification channels
     */
    const subscribeToChannels = async () => {
        try {
            // Subscribe to new notification channels
            await notificationSubscriber.subscribe('user_notifications');
            await notificationSubscriber.subscribe('connection_notifications');
            await notificationSubscriber.subscribe('broadcast_notifications');
            
            // Subscribe to legacy channel for backwards compatibility
            await notificationSubscriber.subscribe('socket.io-response#/#');
            
            console.log('✅ Subscribed to all notification channels');
            
            // Set up message handlers
            notificationSubscriber.on('message', (channel, message) => {
                switch (channel) {
                    case 'user_notifications':
                        handleUserNotifications(channel, message);
                        break;
                        
                    case 'connection_notifications':
                        handleConnectionNotifications(channel, message);
                        break;
                        
                    case 'broadcast_notifications':
                        handleBroadcastNotifications(channel, message);
                        break;
                        
                    case 'socket.io-response#/#':
                        handleLegacyMessages(channel, message);
                        break;
                        
                    default:
                        console.warn(`⚠️ Unknown channel: ${channel}`);
                        break;
                }
            });
            
        } catch (error) {
            console.error('❌ Failed to subscribe to Redis channels:', error);
            
            const logEntry = logger.generateLogEntry(
                'redis_subscription_error',
                null,
                'Failed to subscribe to Redis channels',
                { error: error.message }
            );
            console.error(JSON.stringify(logEntry));
        }
    };
    
    // Initialize subscriptions
    subscribeToChannels();
    
    /**
     * Utility functions for sending notifications from within the server
     */
    
    /**
     * Send notification to specific user (all their connections)
     * 
     * @param {number} userId - Target user ID
     * @param {object} notification - Notification object
     */
    const notifyUser = (userId, notification) => {
        const payload = {
            type: 'user_notification',
            target_user_id: userId,
            timestamp: Date.now(),
            notification: notification
        };
        
        pubClient.publish('user_notifications', JSON.stringify(payload));
    };
    
    /**
     * Send notification to specific connection
     * 
     * @param {string} connectionId - Target connection ID
     * @param {object} notification - Notification object
     */
    const notifyConnection = (connectionId, notification) => {
        const payload = {
            type: 'connection_notification',
            target_connection_id: connectionId,
            timestamp: Date.now(),
            notification: notification
        };
        
        pubClient.publish('connection_notifications', JSON.stringify(payload));
    };
    
    /**
     * Broadcast notification to all connections
     * 
     * @param {object} notification - Notification object
     */
    const broadcastNotification = (notification) => {
        const payload = {
            type: 'broadcast',
            timestamp: Date.now(),
            notification: notification
        };
        
        pubClient.publish('broadcast_notifications', JSON.stringify(payload));
    };
    
    // Attach utility functions to io object for easy access
    io.notifyUser = notifyUser;
    io.notifyConnection = notifyConnection;
    io.broadcastNotification = broadcastNotification;
    
    /**
     * Health check for Redis connections
     */
    const checkRedisHealth = () => {
        return {
            pubClient: pubClient.status,
            subClient: subClient.status,
            notificationSubscriber: notificationSubscriber.status,
            adapter_connected: redisAdapter && redisAdapter.pubClient && redisAdapter.subClient
        };
    };
    
    // Attach health check to io object
    io.getRedisHealth = checkRedisHealth;
    
    /**
     * Graceful shutdown handler
     */
    const gracefulShutdown = async () => {
        console.log('📤 Shutting down Redis connections...');
        
        try {
            await notificationSubscriber.quit();
            await subClient.quit();
            await pubClient.quit();
            console.log('✅ Redis connections closed gracefully');
        } catch (error) {
            console.error('❌ Error during Redis shutdown:', error);
        }
    };
    
    // Attach shutdown handler to io object
    io.gracefulShutdown = gracefulShutdown;
    
    console.log('🎯 Redis notification system initialized successfully');
    
    return {
        redisAdapter,
        notifyUser,
        notifyConnection,
        broadcastNotification,
        checkRedisHealth,
        gracefulShutdown
    };
};