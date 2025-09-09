/**
 * Socket.IO Authentication & Connection Debugger
 * 
 * This module provides detailed debugging for authentication and connection issues,
 * specifically designed to help diagnose client disconnection problems.
 */

class SocketIODebugger {
    constructor() {
        this.connections = new Map();
        this.authAttempts = new Map();
        this.disconnections = new Map();
        this.startTime = Date.now();
    }

    /**
     * Log authentication attempt start
     */
    logAuthStart(socket, token) {
        const authAttempt = {
            socketId: socket.id,
            startTime: Date.now(),
            clientIP: socket.handshake.address,
            userAgent: socket.handshake.headers['user-agent'],
            token: token ? {
                provided: true,
                length: token.length,
                preview: token.substring(0, 20) + '...',
                source: socket.handshake.auth?.token ? 'auth.token' : 'query.token'
            } : { provided: false },
            status: 'started'
        };

        this.authAttempts.set(socket.id, authAttempt);
        
        console.log(`🔐 [AUTH-START] Socket ${socket.id}`);
        console.log(`   📍 Client: ${authAttempt.clientIP}`);
        console.log(`   🎫 Token: ${authAttempt.token.provided ? 'PROVIDED' : 'MISSING'}`);
        if (authAttempt.token.provided) {
            console.log(`   📄 Token preview: ${authAttempt.token.preview}`);
            console.log(`   📝 Token source: ${authAttempt.token.source}`);
            console.log(`   📏 Token length: ${authAttempt.token.length} chars`);
        }
    }

    /**
     * Log JWT token validation details
     */
    logTokenValidation(socket, token, result, error) {
        const authAttempt = this.authAttempts.get(socket.id);
        if (!authAttempt) return;

        const validationTime = Date.now();
        authAttempt.validation = {
            time: validationTime,
            duration: validationTime - authAttempt.startTime,
            success: !error
        };

        if (error) {
            authAttempt.validation.error = {
                message: error.message,
                name: error.name,
                stack: error.stack
            };
            authAttempt.status = 'validation_failed';

            console.log(`❌ [AUTH-VALIDATION-FAILED] Socket ${socket.id}`);
            console.log(`   ⏱️  Validation took: ${authAttempt.validation.duration}ms`);
            console.log(`   🚫 Error: ${error.name} - ${error.message}`);
            
            // Check for common JWT errors
            if (error.message.includes('expired')) {
                console.log(`   ⏰ TOKEN EXPIRED - Check token expiration time`);
            } else if (error.message.includes('signature')) {
                console.log(`   🔐 SIGNATURE INVALID - Check JWT secret key`);
            } else if (error.message.includes('malformed')) {
                console.log(`   🔧 MALFORMED TOKEN - Check token format`);
            }
        } else {
            authAttempt.validation.payload = result.payload;
            authAttempt.validation.userInfo = result.userInfo;
            authAttempt.status = 'validation_success';

            console.log(`✅ [AUTH-VALIDATION-SUCCESS] Socket ${socket.id}`);
            console.log(`   ⏱️  Validation took: ${authAttempt.validation.duration}ms`);
            console.log(`   👤 User ID: ${result.userInfo.userId}`);
            console.log(`   🔗 Connection ID: ${result.userInfo.connectionId}`);
            console.log(`   👨‍💼 Username: ${result.userInfo.username}`);
            console.log(`   ⏰ Expires: ${result.userInfo.expiresAt}`);
        }
    }

    /**
     * Log connection registration details
     */
    logConnectionRegistration(socket, registrationResult) {
        const authAttempt = this.authAttempts.get(socket.id);
        if (!authAttempt) return;

        const regTime = Date.now();
        authAttempt.registration = {
            time: regTime,
            duration: regTime - authAttempt.startTime,
            success: registrationResult.success,
            result: registrationResult
        };

        if (registrationResult.success) {
            authAttempt.status = 'registered';
            console.log(`✅ [CONNECTION-REGISTERED] Socket ${socket.id}`);
            console.log(`   ⏱️  Total auth time: ${authAttempt.registration.duration}ms`);
            console.log(`   🎯 User connections: ${registrationResult.userConnectionCount}`);
        } else {
            authAttempt.status = 'registration_failed';
            console.log(`❌ [CONNECTION-REGISTRATION-FAILED] Socket ${socket.id}`);
            console.log(`   🚫 Reason: ${registrationResult.error || 'Unknown'}`);
        }
    }

    /**
     * Log authentication completion
     */
    logAuthComplete(socket, success, error) {
        const authAttempt = this.authAttempts.get(socket.id);
        if (!authAttempt) return;

        const completeTime = Date.now();
        authAttempt.completion = {
            time: completeTime,
            totalDuration: completeTime - authAttempt.startTime,
            success,
            error: error ? error.message : null
        };

        const connection = {
            socketId: socket.id,
            userId: socket.userId,
            connectionId: socket.connectionId,
            authenticatedAt: completeTime,
            authDuration: authAttempt.completion.totalDuration
        };

        if (success) {
            authAttempt.status = 'authenticated';
            this.connections.set(socket.id, connection);
            
            console.log(`🎉 [AUTH-COMPLETE-SUCCESS] Socket ${socket.id}`);
            console.log(`   ⏱️  Total auth duration: ${authAttempt.completion.totalDuration}ms`);
            console.log(`   👤 User ID: ${socket.userId}`);
            console.log(`   🔗 Connection ID: ${socket.connectionId}`);
            console.log(`   🏠 Rooms joined: ${Array.from(socket.rooms).join(', ')}`);
        } else {
            authAttempt.status = 'failed';
            console.log(`💥 [AUTH-COMPLETE-FAILED] Socket ${socket.id}`);
            console.log(`   ⏱️  Failed after: ${authAttempt.completion.totalDuration}ms`);
            console.log(`   🚫 Error: ${error?.message || 'Unknown error'}`);
        }
    }

    /**
     * Log disconnection with analysis
     */
    logDisconnection(socket, reason) {
        const authAttempt = this.authAttempts.get(socket.id);
        const connection = this.connections.get(socket.id);
        
        const disconnectTime = Date.now();
        const connectedDuration = socket.connectedAt ? disconnectTime - socket.connectedAt.getTime() : 0;

        const disconnection = {
            socketId: socket.id,
            reason,
            disconnectedAt: disconnectTime,
            connectedDuration,
            wasAuthenticated: !!socket.userId,
            authAttempt: authAttempt || null
        };

        this.disconnections.set(socket.id, disconnection);

        console.log(`🔌 [DISCONNECT] Socket ${socket.id}`);
        console.log(`   📅 Reason: ${reason}`);
        console.log(`   ⏱️  Connected for: ${connectedDuration}ms (${(connectedDuration/1000).toFixed(1)}s)`);
        console.log(`   🔐 Was authenticated: ${disconnection.wasAuthenticated ? 'YES' : 'NO'}`);

        // Analyze disconnection patterns
        if (connectedDuration < 6000) { // Less than 6 seconds
            console.log(`   ⚠️  QUICK DISCONNECT - Connected for less than 6 seconds!`);
            
            if (authAttempt) {
                console.log(`   🔍 Auth status: ${authAttempt.status}`);
                
                if (authAttempt.status === 'started' || authAttempt.status === 'validation_failed') {
                    console.log(`   💡 LIKELY CAUSE: Authentication failed or timed out`);
                    if (authAttempt.validation?.error) {
                        console.log(`   🎯 Auth error: ${authAttempt.validation.error.message}`);
                    }
                } else if (connectedDuration >= 4500 && connectedDuration <= 5500) {
                    console.log(`   💡 LIKELY CAUSE: 5-second authentication timeout triggered`);
                } else if (connectedDuration >= 29500 && connectedDuration <= 30500) {
                    console.log(`   💡 LIKELY CAUSE: 30-second authentication timeout triggered`);
                }
            } else {
                console.log(`   💡 LIKELY CAUSE: Authentication middleware rejected connection`);
            }
        }

        // Clean up
        this.authAttempts.delete(socket.id);
        this.connections.delete(socket.id);
    }

    /**
     * Generate debugging summary
     */
    getSummary() {
        const now = Date.now();
        const uptime = now - this.startTime;
        
        const authStats = Array.from(this.authAttempts.values());
        const disconnectStats = Array.from(this.disconnections.values());
        
        const stats = {
            uptime: uptime,
            uptimeFormatted: `${(uptime/1000).toFixed(1)}s`,
            currentConnections: this.connections.size,
            totalAuthAttempts: authStats.length + disconnectStats.length,
            successfulAuths: authStats.filter(a => a.status === 'authenticated').length + 
                           disconnectStats.filter(d => d.wasAuthenticated).length,
            failedAuths: authStats.filter(a => a.status === 'failed').length + 
                        disconnectStats.filter(d => !d.wasAuthenticated).length,
            quickDisconnects: disconnectStats.filter(d => d.connectedDuration < 6000).length,
            avgConnectionDuration: disconnectStats.length > 0 ? 
                disconnectStats.reduce((sum, d) => sum + d.connectedDuration, 0) / disconnectStats.length : 0
        };

        return stats;
    }

    /**
     * Print current debugging summary
     */
    printSummary() {
        const summary = this.getSummary();
        
        console.log(`\n📊 [SOCKETIO-DEBUG-SUMMARY]`);
        console.log(`   ⏰ Server uptime: ${summary.uptimeFormatted}`);
        console.log(`   🔌 Current connections: ${summary.currentConnections}`);
        console.log(`   🎫 Total auth attempts: ${summary.totalAuthAttempts}`);
        console.log(`   ✅ Successful auths: ${summary.successfulAuths}`);
        console.log(`   ❌ Failed auths: ${summary.failedAuths}`);
        console.log(`   ⚡ Quick disconnects (<6s): ${summary.quickDisconnects}`);
        console.log(`   ⏱️  Avg connection duration: ${(summary.avgConnectionDuration/1000).toFixed(1)}s\n`);
    }
}

module.exports = SocketIODebugger;
