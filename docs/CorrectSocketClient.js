/**
 * CORRECT Socket.IO Client Implementation
 * 
 * This shows the proper way to connect to Socket.IO and handle responses
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
                this.authToken = data.connectionToken;
                
                // Store the connection-specific token for this tab
                sessionStorage.setItem('connectionToken', this.authToken);
            });

            this.socket.on('authentication_failed', (data) => {
                console.error('🚫 Authentication failed:', data);
                // Handle authentication failure
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
