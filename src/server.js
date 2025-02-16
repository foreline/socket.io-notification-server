/*
 *
 */

const fs = require('node:fs');

const express = require('express');
const app = express();
const config = require('./utils/config.js');

const { Server } = require("socket.io");

const options = {
    cert: fs.readFileSync(config.server.sslCertificate),
    key: fs.readFileSync(config.server.ssLCertificateKey),
};

const https = require('https').createServer(options, app);

const setupSocketIO = require('./socket.js'); // Import socket.js

const io = Server(https, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    // @fixme need to attach redis adapter
    /*adapter: require('socket.io-redis')({
        host: config.redis.host || 'localhost',
        port: config.redis.port || 6379
    })*/
});

// Initialize Socket.IO with Redis adapter
setupSocketIO(io);


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