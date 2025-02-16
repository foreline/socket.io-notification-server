/*
 *
 */

const { createClient } = require('redis');
const { createAdapter } = require('socket.io-redis');

// Redis client configuration
const redisClient = createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
    }
});

// Create a separate Redis subscriber
const redisSubscriber = redisClient.duplicate();

// Handle Redis connection errors
redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
    process.exit(1);
});

// Subscribe to messages channel
redisSubscriber.subscribe('socket.io-response#/*', (err, count) => {
    if ( err ) {
        console.error('Error subscribing to Redis channel: ', err);
        return;
    }
    console.log(`Subscribed to ${count} channels`);
});

// Handle incoming Redis messages
redisSubscriber.on('message', (channel, message) => {
    console.log({channel});
    if ('socket.io-response#/*' === channel) {
        try {
            const parsedMessage = JSON.parse(message);
            io.emit('broadcast', {
                sender: 'server',
                message: parsedMessage
            });
        } catch (error) {
            console.error('Error parsing Redis message: ', error);
        }
    }
});

// debug
redisSubscriber.on('*', (channel, message) => {
    console.log({channel});
    console.log({message});
});

// Create Redis adapter for Socket.IO
const redisAdapter = createAdapter(redisClient);

// Export the Socket.IO configuration
module.exports = (io) => {
    // Configure Socket.IO options
    io.adapter(redisAdapter);
    
    // Configure Socket.IO options for production
    io.on('connection', (socket) => {
        console.log(`Client ${socket.id} connected`);
        
        // Handle connection events
        socket.on('message', (data) => {
            console.log(`Received message from ${socket.id}:`, data);
            // Broadcast to all clients except sender
            socket.broadcast.emit('message', {
                sender: socket.id,
                message: data
            });
        });
        
        // Handle disconnection
        socket.on('disconnect', (reason) => {
            console.log(`Client ${socket.id} disconnected: ${reason}`);
        });
        
        // Handle errors
        socket.on('error', (err) => {
            console.error(`Socket error for ${socket.id}:`, err);
        });
    });
    
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