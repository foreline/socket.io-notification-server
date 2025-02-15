/*
 *
 */

const fs = require('node:fs');

const express = require('express');
const app = express();

const options = {
    cert: fs.readFileSync(process.env.SSL_CERTIFICATE),
    key: fs.readFileSync(process.env.SSL_CERTIFICATE_KEY),
};

const https = require('https').createServer(options, app);

const io = require('socket.io')(https, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    adapter: require('socket.io-redis')({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
    })
});

// Store connected clients
const clients = new Map();

io.on('connection', (socket) => {
    const clientId = socket.id;
    
    // Handle connection
    console.log(`Client ${clientId} connected`);
    clients.set(clientId, socket.id);
    
    // Broadcast client count
    io.emit('clientCount', clients.size);
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Client ${clientId} disconnected`);
        clients.delete(clientId);
        io.emit('clientCount', clients.size);
    });
    
    // Handle custom events
    socket.on('message', (data) => {
        console.log(`Received: ${data}`);
        io.emit('broadcast', {
            sender: clientId,
            message: data
        });
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', connectedClients: clients.size });
});

const PORT = process.env.PORT || 3000;

https.listen(PORT, () => {
    console.log(`Socket.IO server running on port ${PORT}`);
});