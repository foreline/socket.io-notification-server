/*
 * logger middleware
 */

const { randomUUID } = require('node:crypto');

class LoggerMiddleware {
    constructor() {
        this.logFormat = {
            timestamp: null,
            requestId: null,
            eventType: null,
            clientId: null,
            message: null,
            metadata: {}
        };
    }
    
    // Generate a formatted log entry
    generateLogEntry(eventType, clientId, message, metadata = {}) {
        return {
            ...this.logFormat,
            timestamp: new Date().toISOString(),
            requestId: randomUUID(),
            eventType,
            clientId,
            message,
            metadata
        };
    }
    
    // Main middleware handler
    handle(socket, next) {
        const logEntry = this.generateLogEntry('connection_attempt', socket.id);
        
        console.log(JSON.stringify(logEntry));
        
        socket.on('connect', () => {
            const connectLog = this.generateLogEntry(
                'connection_success',
                socket.id,
                'Client connected'
            );
            console.log(JSON.stringify(connectLog));
        });
        
        socket.on('disconnect', (reason) => {
            const disconnectLog = this.generateLogEntry(
                'disconnection',
                socket.id,
                `Client disconnected: ${reason}`
            );
            console.log(JSON.stringify(disconnectLog));
        });
        
        socket.on('message', (data) => {
            const messageLog = this.generateLogEntry(
                'message_received',
                socket.id,
                'Message received',
                { messageData: data }
            );
            console.log(JSON.stringify(messageLog));
            
            // Broadcast handling
            const broadcastLog = this.generateLogEntry(
                'broadcast_sent',
                socket.id,
                'Broadcast message sent',
                { messageData: data }
            );
            console.log(JSON.stringify(broadcastLog));
        });
        
        next();
    }
    
    // Error handler middleware
    handleError(error, socket, next) {
        const errorLog = this.generateLogEntry(
            'error_occurred',
            socket?.id || 'unknown',
            error.message,
            { errorDetails: error }
        );
        console.error(JSON.stringify(errorLog));
        next(error);
    }
}

module.exports = LoggerMiddleware;