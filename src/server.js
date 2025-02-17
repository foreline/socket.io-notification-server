/*
 *
 */

const fs = require('node:fs');

const express = require('express');
const app = express();
const config = require('./utils/config.js');
const LoggerMiddleware = require('./middleware/logger.js');
const AuthMiddleware = require('./middleware/auth.js');

// Initialize logger middleware
const logger = new LoggerMiddleware();
const authMiddleware = new AuthMiddleware(process.env.JWT_SECRET);

const { Server } = require("socket.io");

const options = {
    cert: fs.readFileSync(config.server.sslCertificate),
    key: fs.readFileSync(config.server.ssLCertificateKey),
};

const https = require('https').createServer(options, app);

// Import socket.js
const setupSocketIO = require('./socket.js');

const io = new Server(https, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Initialize Socket.IO with Redis adapter
setupSocketIO(io, logger);

// Use the logger middleware
io.use((socket, next) => {
    logger.handle(socket, next);
});

// Use the authentication middleware
io.use((socket, next) => {
    authMiddleware.handle(socket, next);
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
    
    const healthData = {
        status: 'healthy',
        connectedClients: io.engine.clientsCount
    };
    
    const logEntry = logger.generateLogEntry(
        'health_check',
        null,
        'Health check performed',
        healthData
    );
    console.log(JSON.stringify(logEntry));
    
    res.json({ status: 'healthy', connectedClients: clients.size });
});

const PORT = process.env.PORT || 3000;

https.listen(PORT, () => {
    console.log(`Socket.IO server running on port ${PORT}`);
});