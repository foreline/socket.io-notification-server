git m/**
 * CORRECT Socket.IO Client Implementation
 * 
 * This shows the proper way to connect to Socket.IO and handle responses
 * 
 * IMPORTANT: Your JWT token MUST be generated with:
 *   - issuer: 'servicedesk-server'
 *   - audience: 'servicedesk-client'
 *   - user_id: numeric integer (not string like 'user123')
 * 
 * Use TokenGenerator on server side or ensure your token generator includes:
 *   jwt.sign(payload, secret, {
 *     issuer: 'servicedesk-server',
 *     audience: 'servicedesk-client',
 *     expiresIn: '1h'
 *   })
 */

class CorrectSocketClient {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.authToken = null;
        this.isConnected = false;
    }

    /**
     * CORRECT: Use Socket.IO client library, not raw HTTP requests
     */
    async connect(jwtToken) {
        try {
            // Import Socket.IO client (in browser, use script tag)
            // <script src="/socket.io/socket.io.js"></script>
            
            console.log('🔌 Connecting to Socket.IO server...');
            
            // CORRECT: Use Socket.IO client with auth
            this.socket = io(this.serverUrl, {
                auth: {
                    token: jwtToken  // JWT token for authentication
                },
                transports: ['websocket', 'polling'],  // Specify transports
                timeout: 10000
            });

            // Handle connection events
            this.socket.on('connect', () => {
                console.log('✅ Connected to Socket.IO server');
                console.log('Connection ID:', this.socket.id);
                this.isConnected = true;
            });

            this.socket.on('disconnect', (reason) => {
                console.log('❌ Disconnected from server:', reason);
                this.isConnected = false;
            });

            // Handle authentication responses
            this.socket.on('authenticated', (data) => {
                console.log('🔐 Authentication successful:', data);
                console.log('   User:', data.username, `(ID: ${data.user_id})`);
                console.log('   Connection ID:', data.connection_id);
                console.log('   Token expires:', data.expires_at);
                console.log('   Active connections:', data.connection_count);
                
                // Store connection info
                this.authToken = data.connection_id;
                sessionStorage.setItem('connectionId', data.connection_id);
                sessionStorage.setItem('userId', data.user_id);
            });

            this.socket.on('authentication_failed', (data) => {
                console.error('🚫 Authentication failed:', data);
                console.error('   Code:', data.code);
                console.error('   Message:', data.message);
                console.error('   Help:', data.help);
                
                // Common fixes for authentication errors:
                if (data.code === 'AUTH_FAILED' && data.message.includes('audience invalid')) {
                    console.error('❌ TOKEN AUDIENCE MISMATCH!');
                    console.error('   Your token must be generated with audience: "servicedesk-client"');
                    console.error('   Check your token generation code or use TokenGenerator utility');
                }
                
                // Handle authentication failure - possibly redirect to login
                if (typeof window !== 'undefined') {
                    // Browser environment
                    setTimeout(() => {
                        alert('Authentication failed: ' + data.message);
                        // window.location.href = '/login';
                    }, 1000);
                }
            });
            
            // Handle token expiring warning
            this.socket.on('token_expiring', (data) => {
                console.warn('⚠️ Token expiring soon:', data.expires_at);
                console.warn('   Please refresh your session');
                
                // Trigger token refresh logic
                this.handleTokenExpiring(data);
            });

            // Handle application events
            this.socket.on('user_message', (data) => {
                console.log('📨 Received message:', data);
                // NO JSON.parse needed! Socket.IO handles this automatically
                this.handleUserMessage(data);
            });

            this.socket.on('notification', (data) => {
                console.log('🔔 Received notification:', data);
                // Data is already parsed by Socket.IO
                this.handleNotification(data);
            });

            this.socket.on('pong', (data) => {
                console.log('🏓 Pong received:', data);
                // Already an object, no parsing needed
            });

            // Handle connection errors
            this.socket.on('connect_error', (error) => {
                console.error('🔌 Connection error:', error);
            });

        } catch (error) {
            console.error('❌ Failed to connect:', error);
            throw error;
        }
    }

    /**
     * CORRECT: Send messages through Socket.IO, not HTTP
     */
    sendMessage(message) {
        if (!this.isConnected) {
            console.error('❌ Not connected to server');
            return;
        }

        // CORRECT: Use socket.emit, Socket.IO handles serialization
        this.socket.emit('user_message', {
            content: message,
            timestamp: new Date().toISOString(),
            connectionToken: this.authToken
        });
        
        console.log('📤 Message sent:', message);
    }

    /**
     * CORRECT: Ping through Socket.IO
     */
    ping() {
        if (!this.isConnected) {
            console.error('❌ Not connected to server');
            return;
        }

        // CORRECT: Use socket.emit for ping
        this.socket.emit('ping', {
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Handle incoming messages (already parsed by Socket.IO)
     */
    handleUserMessage(data) {
        // Data is already a JavaScript object
        console.log('Processing message:', data);
        
        // Update UI with message
        // NO JSON.parse needed!
    }

    /**
     * Handle notifications (already parsed by Socket.IO)
     */
    handleNotification(data) {
        // Data is already a JavaScript object
        console.log('Processing notification:', data);
        
        // Show notification to user
        // NO JSON.parse needed!
    }

    /**
     * Refresh authentication token
     * IMPORTANT: New token must have same user_id as original
     */
    refreshToken(newJwtToken) {
        if (!this.isConnected) {
            console.error('❌ Not connected to server');
            return;
        }

        console.log('🔄 Refreshing authentication token...');
        this.socket.emit('refresh_token', { token: newJwtToken });
    }

    /**
     * Handle token expiring warning
     */
    handleTokenExpiring(data) {
        // Implement your token refresh logic here
        // For example, request a new token from your backend
        console.warn('⚠️ Implement token refresh logic');
        
        // Example:
        // fetch('/api/refresh-token', { method: 'POST' })
        //   .then(res => res.json())
        //   .then(data => this.refreshToken(data.token));
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            console.log('🔌 Disconnected from server');
        }
    }
}

/**
 * Example usage:
 */
async function example() {
    const client = new CorrectSocketClient('http://localhost:3001');
    
    // Get JWT token from your authentication system
    const jwtToken = 'your-jwt-token-here';
    
    try {
        await client.connect(jwtToken);
        
        // Send a message after connection
        setTimeout(() => {
            client.sendMessage('Hello from client!');
        }, 1000);
        
    } catch (error) {
        console.error('Connection failed:', error);
    }
}
