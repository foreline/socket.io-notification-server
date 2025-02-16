/*
 *
 */

const Redis = require("ioredis");

const { createAdapter } = require("@socket.io/redis-adapter");

// Redis client configuration
/*const redisClient = createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
    }
});*/

// Create redis publisher and subscriber
const pubClient = new Redis();
const subClient = pubClient.duplicate();

// Handle Redis connection errors
subClient.on('error', (err) => {
    console.error('[REDIS] connection error:', err);
    process.exit(1);
});

/*subClient.on('message', (channel, message) => {
    console.log('[REDIS] Received message on channel:', channel);
    console.log('[REDIS] Raw message:', message);
});*/

// Subscribe to messages channel
/*subClient.subscribe('socket.io-response#/#', (err, count) => {
    if ( err ) {
        console.error('[REDIS] Error subscribing to Redis channel: ', err);
        return;
    }
    console.log(`[REDIS] Subscribed to ${count} channels`);
});*/

// Handle incoming Redis messages
/*subClient.on('message', (channel, message) => {
    console.log('[REDIS] Received message on channel:', channel);
    console.log('[REDIS] Raw message:', message);
    
    if ('socket.io-response#/#' === channel) {
        try {
            const parsedMessage = JSON.parse(message);
            io.emit('broadcast', {
                sender: 'server',
                message: parsedMessage
            });
        } catch (error) {
            console.error('[REDIS] Error parsing Redis message: ', error);
        }
    }
});*/

// Create Redis adapter for Socket.IO
const redisAdapter = createAdapter(pubClient, subClient, {});


// Export the Socket.IO configuration
module.exports = (io) => {
    
    // Configure Socket.IO options
    io.adapter(redisAdapter);
    
    // Configure Socket.IO options for production
    io.on('connection', (socket) => {
        console.log(`[SOCKET.IO] Client ${socket.id} connected`);
        
        // Handle connection events
        socket.on('message', (data) => {
            console.log(`[SOCKET.IO] Received message from ${socket.id}:`, data);
            // Broadcast to all clients except sender
            socket.broadcast.emit('message', {
                sender: socket.id,
                message: data
            });
        });
        
        // Handle disconnection
        socket.on('disconnect', (reason) => {
            console.log(`[SOCKET.IO] Client ${socket.id} disconnected: ${reason}`);
        });
        
        // Handle errors
        socket.on('error', (err) => {
            console.error(`[SOCKET.IO] Socket error for ${socket.id}:`, err);
        });
    });
    
    // Configure Redis message handling with proper scope
    const handleRedisMessage = (channel, message) => {
        console.log('[REDIS] Received message on channel:', channel);
        console.log('[REDIS] Raw message:', message);
        
        if ( 'socket.io-response#/#' === channel ) {
            try {
                const parsedMessage = JSON.parse(message);
                
                console.log('[SOCKET.IO] Emitting broadcast message');
                console.log({parsedMessage});
                
                io.emit('broadcast', {
                    sender: 'server',
                    message: parsedMessage
                });
            } catch (error) {
                console.error('[REDIS] Error parsing Redis message: ', error);
            }
        } else {
            console.warn('[SOCKET.IO] Channel not matched');
            const parsedMessage = JSON.parse(message);
            console.log('[SOCKET.IO] Emitting broadcast message');
            console.log({parsedMessage});
    
            io.emit('broadcast', {
                sender: 'server',
                message: parsedMessage
            });
        }
    };
    
    // Subscribe to messages channel
    subClient.subscribe('socket.io-response#/#', (err, count) => {
        if (err) {
            console.error('[REDIS] Error subscribing to Redis channel: ', err);
            return;
        }
        console.log(`[REDIS] Subscribed to ${count} channels`);
    });
    
    // Set up event listener with bound context
    subClient.on('message', handleRedisMessage.bind(null));
    
    // Configure Socket.IO options
    return {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["Content-Type", "Authorization"],
            credentials: true
        },
        adapter: redisAdapter,
        pingTimeout: 60000, // 60 seconds
        pingInterval: 25000, // 25 seconds
        upgradeTimeout: 10000, // 10 seconds
        maxHttpBufferSize: 1e6, // 1MB
        perMessageDeflate: false,
        allowEIO3: true,
        cookie: {
            name: 'socket.io',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production'
        }
    };
};