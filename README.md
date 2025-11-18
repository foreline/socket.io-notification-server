# ServiceDesk Socket.IO Server - Connection-Specific Authentication

A secure, scalable Socket.IO server implementation for real-time notifications using connection-specific JWT tokens. Each browser tab gets a unique token that cannot be reused by other connections, providing maximum security for multi-device scenarios.

## 🔥 Features

- ✅ **Connection-specific JWT tokens** - Each browser tab gets unique token
- ✅ **Secure authentication** - Cryptographically signed, tamper-proof tokens
- ✅ **Server-controlled room assignment** - Users cannot choose rooms
- ✅ **Token expiration handling** - Automatic cleanup of old connections
- ✅ **Redis pub/sub notifications** - Scalable notification delivery
- ✅ **Connection management** - Track and manage user connections
- ✅ **Health monitoring** - Comprehensive health checks and statistics
- ✅ **Framework agnostic** - Works with any backend framework
- ✅ **Production ready** - Full error handling and logging


## Requirements

- Node.js 16.0.0 or higher
- Redis server
- NPM dependencies (automatically installed)

## 🚀 Quick Start

### 1. Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp config/.env.example config/.env

# Edit .env file with your settings
# Set at minimum: JWT_SECRET, REDIS_HOST, REDIS_PORT
```

### 2. Environment Configuration

```bash
# Required settings in config/.env
JWT_SECRET=your-super-secure-random-secret-key
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Optional settings
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
```

### 3. Start the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Using PM2 for production
npm run pm2:start
```

## 📡 Redis Notification Channels

The server listens to these Redis channels for notifications:

### User Notifications
Send to all connections of a specific user:
```redis
PUBLISH user_notifications '{
  "type": "user_notification",
  "target_user_id": 123,
  "notification": {
    "title": "New Ticket",
    "message": "You have a new support ticket",
    "type": "ticket_created"
  }
}'
```

### Connection-Specific Notifications
Send to a specific browser tab:
```redis
PUBLISH connection_notifications '{
  "type": "connection_notification", 
  "target_connection_id": "abc123_connection_id",
  "notification": {
    "title": "Session Update",
    "message": "Your session has been updated"
  }
}'
```

### Broadcast Notifications
Send to all connected users:
```redis
PUBLISH broadcast_notifications '{
  "type": "broadcast",
  "notification": {
    "title": "System Maintenance",
    "message": "System will be down for maintenance in 10 minutes"
  }
}'
```

## 🔐 JWT Token Structure

Connection-specific tokens must include these claims:

```json
{
  "iss": "servicedesk-server",
  "aud": "servicedesk-client",
  "iat": 1234567890,
  "exp": 1234567890,
  "nbf": 1234567890,
  "jti": "unique_connection_id",
  "user_id": 123,
  "connection_id": "unique_connection_id",
  "session_id": "php_session_id",
  "user_agent_hash": "hash_of_user_agent",
  "ip_hash": "hash_of_client_ip",
  "username": "john.doe",
  "full_name": "John Doe",
  "is_admin": false,
  "permissions": {
    "can_view_tickets": true,
    "can_create_tickets": true
  }
}
```

## 🌐 HTTP Endpoints

- `GET /health` - Server health status and connection statistics
- `GET /stats` - Detailed connection statistics and user breakdown  
- `GET /users` - List of currently active users and connection counts
- `POST /admin/cleanup` - Manual cleanup of stale connections (dev only)

## 🔧 Client-Side Usage

```javascript
// Connect with JWT token
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token-from-backend' }
});

// Handle authentication
socket.on('authenticated', (data) => {
  console.log('Authenticated:', data);
  console.log('User ID:', data.user_id);
  console.log('Connection ID:', data.connection_id);
});

socket.on('authentication_failed', (error) => {
  console.error('Auth failed:', error);
});

// Handle notifications
socket.on('notification', (notification) => {
  console.log('Notification received:', notification);
  showNotification(notification.title, notification.message);
});

// Handle token expiry warning
socket.on('token_expiring', (data) => {
  console.log('Token expiring soon, refresh needed');
  // Implement token refresh logic
});

// Send heartbeat
setInterval(() => {
  socket.emit('ping');
}, 30000);

socket.on('pong', (data) => {
  console.log('Server time:', data.server_time);
});
```

## 🏭 Production Deployment

### Environment Variables

```bash
NODE_ENV=production
JWT_SECRET=your-super-secure-production-secret
REDIS_HOST=your-redis-server.com
REDIS_PASSWORD=your-redis-password
USE_HTTPS=true
SSL_CERT_PATH=/path/to/certificate.crt
SSL_KEY_PATH=/path/to/private.key
CORS_ORIGIN=https://your-domain.com
```

### Using PM2

```bash
npm run pm2:start    # Start
npm run pm2:logs     # Monitor  
npm run pm2:restart  # Restart
npm run pm2:stop     # Stop
```

## 🧪 Testing

### CORS Configuration Testing

Test CORS configuration including preflight OPTIONS requests:

```bash
# Start the server first
npm start

# In another terminal, test CORS
npm test
# or
npm run test:cors
```

The CORS test will verify:
- ✅ Preflight OPTIONS requests are handled correctly
- ✅ Access-Control headers are properly set
- ✅ Cross-origin requests work as expected

### JWT Token Testing

Generate test tokens for development:

```javascript
const JwtHelper = require('./src/utils/JwtHelper');
const jwtHelper = new JwtHelper('your-secret');

const testToken = jwtHelper.createTestToken(123, 'test_connection_123');
console.log('Test token:', testToken);
```

### Redis Notification Testing

Test notifications via Redis:

```bash
redis-cli PUBLISH user_notifications '{
  "type": "user_notification",
  "target_user_id": 123,
  "notification": {"title": "Test", "message": "Hello"}
}'
```

## 🔒 Security Features

- Connection isolation with unique rooms per browser tab
- Cryptographic JWT signature verification  
- Automatic token expiration handling
- Input validation and sanitization
- Comprehensive audit logging
- Rate limiting protection

## 📚 Key Components

### ConnectionManager
Manages user connections, tracks connection-specific rooms, handles lifecycle:
- `registerConnection()` - Register authenticated connection
- `getUserConnections()` - Get all connections for user
- `getStats()` - Get connection statistics

### JwtHelper  
Handles connection-specific JWT validation:
- `verifyToken()` - Verify and decode JWT
- `authenticateToken()` - Complete authentication flow
- `createTestToken()` - Generate test tokens (dev only)

## 🛠️ Troubleshooting

**Authentication fails**: Check JWT secret matches, verify token structure
**Redis errors**: Verify Redis server running, check host/port config  
**CORS errors**: 
  - Update CORS_ORIGIN environment variable with your frontend domain
  - For production, use specific domains instead of `*`
  - OPTIONS method is automatically included for preflight requests
  - Ensure credentials are properly configured if using authentication
**SSL issues**: Verify certificate paths and validity

### Common CORS Issues in Production

1. **Preflight failures**: Make sure your CORS_ORIGIN includes the exact frontend domain
   ```bash
   # Example for production
   CORS_ORIGIN=https://your-frontend-domain.com
   
   # Multiple domains
   CORS_ORIGIN=https://app.domain.com,https://admin.domain.com
   ```

2. **Credentials errors**: When using authentication, ensure both frontend and backend are configured for credentials:
   ```javascript
   // Frontend
   const socket = io('https://your-api.com', {
     withCredentials: true,
     auth: { token: 'your-jwt-token' }
   });
   ```

Enable debug mode: `DEBUG_MODE=true npm start`

## 📄 Documentation

See [Connection-Specific Token Approach](./docs/CONNECTION_SPECIFIC_TOKEN_APPROACH.md) for complete implementation details including PHP backend integration.

Built with ❤️ for secure real-time communications