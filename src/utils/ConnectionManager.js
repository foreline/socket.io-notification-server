/**
 * Connection Manager for Socket.IO
 * 
 * This class manages user connections, tracks connection-specific rooms,
 * and handles the lifecycle of authenticated connections.
 */

class ConnectionManager {
    constructor() {
        // connectionId -> socket
        this.connections = new Map();
        
        // userId -> Set of connectionIds
        this.userConnections = new Map();
        
        // Statistics tracking
        this.stats = {
            totalConnectionsEver: 0,
            currentConnections: 0,
            currentUsers: 0,
            connectionHistory: []
        };
    }

    /**
     * Register a new authenticated connection
     * 
     * @param {object} socket - Socket.IO socket instance
     * @param {object} payload - Validated JWT payload
     * @returns {object} Registration result
     */
    registerConnection(socket, payload) {
        const { user_id, connection_id } = payload;
        
        try {
            // Check for duplicate connections with same connection_id
            const existingConnection = this.connections.get(connection_id);
            if (existingConnection && existingConnection.connected) {
                console.log(`⚠️ Duplicate connection detected for ${connection_id}, disconnecting old one`);
                existingConnection.disconnect(true);
                this.unregisterConnection(existingConnection);
            }

            // Store connection mapping
            this.connections.set(connection_id, socket);
            
            // Track user connections
            if (!this.userConnections.has(user_id)) {
                this.userConnections.set(user_id, new Set());
            }
            this.userConnections.get(user_id).add(connection_id);
            
            // Store payload in socket for reference
            socket.userId = user_id;
            socket.connectionId = connection_id;
            socket.tokenPayload = payload;
            socket.authenticatedAt = new Date();
            
            // Update statistics
            this.stats.totalConnectionsEver++;
            this.stats.currentConnections = this.connections.size;
            this.stats.currentUsers = this.userConnections.size;
            
            // Add to connection history (keep last 100)
            this.stats.connectionHistory.push({
                type: 'connected',
                userId: user_id,
                connectionId: connection_id,
                timestamp: new Date().toISOString(),
                socketId: socket.id
            });
            
            if (this.stats.connectionHistory.length > 100) {
                this.stats.connectionHistory.shift();
            }
            
            console.log(`✅ Connection registered: User ${user_id}, Connection ${connection_id}, Socket ${socket.id}`);
            console.log(`📊 User ${user_id} now has ${this.userConnections.get(user_id).size} active connections`);
            
            return {
                success: true,
                connectionId: connection_id,
                userId: user_id,
                userConnectionCount: this.userConnections.get(user_id).size,
                totalConnections: this.connections.size
            };
            
        } catch (error) {
            console.error(`❌ Failed to register connection: ${error.message}`);
            throw error;
        }
    }

    /**
     * Unregister a connection
     * 
     * @param {object} socket - Socket.IO socket instance
     * @returns {object} Unregistration result
     */
    unregisterConnection(socket) {
        if (!socket.connectionId || !socket.userId) {
            return { success: false, reason: 'Socket not properly authenticated' };
        }

        const { userId, connectionId } = socket;

        try {
            // Remove from connections map
            this.connections.delete(connectionId);

            // Remove from user connections
            if (this.userConnections.has(userId)) {
                this.userConnections.get(userId).delete(connectionId);

                // Remove user entry if no connections left
                if (this.userConnections.get(userId).size === 0) {
                    this.userConnections.delete(userId);
                }
            }

            // Update statistics
            this.stats.currentConnections = this.connections.size;
            this.stats.currentUsers = this.userConnections.size;
            
            // Add to connection history
            this.stats.connectionHistory.push({
                type: 'disconnected',
                userId: userId,
                connectionId: connectionId,
                timestamp: new Date().toISOString(),
                socketId: socket.id,
                connectedDuration: socket.authenticatedAt ? 
                    Date.now() - socket.authenticatedAt.getTime() : null
            });
            
            if (this.stats.connectionHistory.length > 100) {
                this.stats.connectionHistory.shift();
            }

            const remainingConnections = this.userConnections.get(userId)?.size || 0;
            
            console.log(`❌ Connection unregistered: User ${userId}, Connection ${connectionId}, Socket ${socket.id}`);
            console.log(`📊 User ${userId} now has ${remainingConnections} active connections`);

            return {
                success: true,
                connectionId: connectionId,
                userId: userId,
                remainingUserConnections: remainingConnections,
                totalConnections: this.connections.size
            };
            
        } catch (error) {
            console.error(`❌ Failed to unregister connection: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all active connections for a specific user
     * 
     * @param {number} userId - User ID
     * @returns {Array} Array of active socket instances
     */
    getUserConnections(userId) {
        const connectionIds = this.userConnections.get(userId) || new Set();
        const sockets = [];

        for (const connectionId of connectionIds) {
            const socket = this.connections.get(connectionId);
            if (socket && socket.connected) {
                sockets.push(socket);
            } else {
                // Clean up stale connection reference
                this.userConnections.get(userId)?.delete(connectionId);
                this.connections.delete(connectionId);
            }
        }

        return sockets;
    }

    /**
     * Get connection by connection ID
     * 
     * @param {string} connectionId - Connection ID
     * @returns {object|null} Socket instance or null if not found
     */
    getConnection(connectionId) {
        const socket = this.connections.get(connectionId);
        
        if (socket && socket.connected) {
            return socket;
        } else if (socket) {
            // Clean up disconnected socket
            this.connections.delete(connectionId);
            return null;
        }
        
        return null;
    }

    /**
     * Get all active connections
     * 
     * @returns {Array} Array of all active socket instances
     */
    getAllConnections() {
        const activeSockets = [];
        
        for (const [connectionId, socket] of this.connections.entries()) {
            if (socket && socket.connected) {
                activeSockets.push(socket);
            } else {
                // Clean up stale connection
                this.connections.delete(connectionId);
            }
        }
        
        return activeSockets;
    }

    /**
     * Check if a user has any active connections
     * 
     * @param {number} userId - User ID
     * @returns {boolean} True if user has active connections
     */
    userHasConnections(userId) {
        const connections = this.getUserConnections(userId);
        return connections.length > 0;
    }

    /**
     * Get detailed statistics about connections
     * 
     * @returns {object} Connection statistics
     */
    getStats() {
        // Clean up stale connections first
        this.cleanupStaleConnections();
        
        const userBreakdown = Array.from(this.userConnections.entries()).map(([userId, connectionIds]) => {
            const activeConnections = Array.from(connectionIds).filter(id => {
                const socket = this.connections.get(id);
                return socket && socket.connected;
            });
            
            return {
                userId: parseInt(userId),
                connectionCount: activeConnections.length,
                connectionIds: activeConnections
            };
        }).filter(user => user.connectionCount > 0);

        return {
            totalConnections: this.connections.size,
            totalUsers: this.userConnections.size,
            totalConnectionsEver: this.stats.totalConnectionsEver,
            userBreakdown,
            averageConnectionsPerUser: this.userConnections.size > 0 ? 
                this.connections.size / this.userConnections.size : 0,
            recentActivity: this.stats.connectionHistory.slice(-10), // Last 10 events
            uptimeSeconds: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * Clean up stale connection references
     * 
     * @returns {number} Number of cleaned up connections
     */
    cleanupStaleConnections() {
        let cleanedUp = 0;
        
        // Check all connections for staleness
        for (const [connectionId, socket] of this.connections.entries()) {
            if (!socket || !socket.connected) {
                this.connections.delete(connectionId);
                cleanedUp++;
                
                // Also clean up from user connections
                for (const [userId, connectionIds] of this.userConnections.entries()) {
                    if (connectionIds.has(connectionId)) {
                        connectionIds.delete(connectionId);
                        
                        // Remove user if no connections left
                        if (connectionIds.size === 0) {
                            this.userConnections.delete(userId);
                        }
                    }
                }
            }
        }
        
        // Update current stats
        this.stats.currentConnections = this.connections.size;
        this.stats.currentUsers = this.userConnections.size;
        
        if (cleanedUp > 0) {
            console.log(`🧹 Cleaned up ${cleanedUp} stale connections`);
        }
        
        return cleanedUp;
    }

    /**
     * Generate room name for connection-specific communication
     * 
     * @param {string} connectionId - Connection ID
     * @returns {string} Room name
     */
    getConnectionRoom(connectionId) {
        return `connection_${connectionId}`;
    }

    /**
     * Generate room name for user-wide communication
     * 
     * @param {number} userId - User ID
     * @returns {string} Room name
     */
    getUserRoom(userId) {
        return `user_${userId}`;
    }

    /**
     * Get connection information for a specific socket
     * 
     * @param {object} socket - Socket.IO socket instance
     * @returns {object|null} Connection information or null if not authenticated
     */
    getConnectionInfo(socket) {
        if (!socket.userId || !socket.connectionId) {
            return null;
        }

        return {
            userId: socket.userId,
            connectionId: socket.connectionId,
            socketId: socket.id,
            authenticatedAt: socket.authenticatedAt,
            connectedDuration: socket.authenticatedAt ? 
                Date.now() - socket.authenticatedAt.getTime() : null,
            tokenPayload: socket.tokenPayload,
            rooms: Array.from(socket.rooms),
            connected: socket.connected
        };
    }

    /**
     * Disconnect all connections for a specific user
     * 
     * @param {number} userId - User ID
     * @param {string} reason - Reason for disconnection
     * @returns {number} Number of connections disconnected
     */
    disconnectUser(userId, reason = 'Server initiated disconnect') {
        const userSockets = this.getUserConnections(userId);
        
        userSockets.forEach(socket => {
            socket.disconnect(true);
        });
        
        console.log(`🔌 Disconnected ${userSockets.length} connections for user ${userId}: ${reason}`);
        
        return userSockets.length;
    }

    /**
     * Get summary of active users and their connection counts
     * 
     * @returns {Array} Array of user summaries
     */
    getActiveUsersSummary() {
        return Array.from(this.userConnections.entries()).map(([userId, connectionIds]) => {
            const activeCount = Array.from(connectionIds).filter(id => {
                const socket = this.connections.get(id);
                return socket && socket.connected;
            }).length;
            
            return {
                userId: parseInt(userId),
                activeConnections: activeCount
            };
        }).filter(user => user.activeConnections > 0);
    }
}

module.exports = ConnectionManager;
