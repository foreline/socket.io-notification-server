# Socket.IO Authentication Debugging Guide

## 🚨 Problem: Client Disconnects After 5 Seconds

This guide helps debug authentication and disconnection issues in the Socket.IO server.

## 🔍 Debugging Tools Added

### 1. Enhanced Authentication Logging
- **Detailed token validation logs**
- **Connection registration tracking**
- **Authentication timing analysis**

### 2. SocketIODebugger Class
- **Real-time connection monitoring**
- **Authentication attempt tracking**
- **Disconnection pattern analysis**
- **Periodic summary reports**

### 3. TokenGenerator Utility
- **Generate valid test tokens**
- **Test token expiration scenarios**
- **Verify token validity**

## 🛠️ Quick Debugging Steps

### Step 1: Generate Test Tokens
```bash
npm run debug:auth
```
This will generate several test tokens including:
- Valid 1-hour token
- Short-lived 10-second token
- Admin token
- Expired token (for error testing)

### Step 2: Start Server with Debug Logging
```bash
npm start
```
The server now includes:
- **Real-time authentication logs**
- **Connection timing analysis** 
- **Disconnection reason tracking**
- **30-second summary reports**

### Step 3: Test with Socket.IO Client
```javascript
const socket = io('http://localhost:3001', {
    auth: {
        token: 'PASTE_TEST_TOKEN_HERE' // From step 1
    }
});

socket.on('connect', () => {
    console.log('Connected:', socket.id);
});

socket.on('authenticated', (data) => {
    console.log('Authenticated:', data);
});

socket.on('authentication_failed', (error) => {
    console.error('Auth failed:', error);
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
});
```

## 📊 Understanding the Debug Output

### Authentication Flow Logs
```
🔐 [AUTH-START] Socket abc123
   📍 Client: 127.0.0.1
   🎫 Token: PROVIDED
   📄 Token preview: eyJhbGciOiJIUzI1NiI...
   📝 Token source: auth.token
   📏 Token length: 245 chars

✅ [AUTH-VALIDATION-SUCCESS] Socket abc123
   ⏱️  Validation took: 15ms
   👤 User ID: user123
   🔗 Connection ID: a1b2c3d4e5f6
   👨‍💼 Username: testuser
   ⏰ Expires: 2025-09-09T15:30:00.000Z

✅ [CONNECTION-REGISTERED] Socket abc123
   ⏱️  Total auth time: 25ms
   🎯 User connections: 1

🎉 [AUTH-COMPLETE-SUCCESS] Socket abc123
   ⏱️  Total auth duration: 35ms
   👤 User ID: user123
   🔗 Connection ID: a1b2c3d4e5f6
   🏠 Rooms joined: connection:a1b2c3d4e5f6, user:user123
```

### Disconnection Analysis
```
🔌 [DISCONNECT] Socket abc123
   📅 Reason: client namespace disconnect
   ⏱️  Connected for: 4850ms (4.9s)
   🔐 Was authenticated: NO
   ⚠️  QUICK DISCONNECT - Connected for less than 6 seconds!
   🔍 Auth status: validation_failed
   💡 LIKELY CAUSE: Authentication failed or timed out
   🎯 Auth error: Token validation failed: jwt expired
```

### Periodic Summary
```
📊 [SOCKETIO-DEBUG-SUMMARY]
   ⏰ Server uptime: 125.5s
   🔌 Current connections: 2
   🎫 Total auth attempts: 8
   ✅ Successful auths: 5
   ❌ Failed auths: 3
   ⚡ Quick disconnects (<6s): 2
   ⏱️  Avg connection duration: 45.2s
```

## 🎯 Common Issues & Solutions

### Issue 1: 5-Second Disconnection
**Symptoms:** Client connects but disconnects exactly after 5 seconds
**Debug Output:** `LIKELY CAUSE: 5-second authentication timeout triggered`
**Solution:** Check authentication error - usually token validation failure

### Issue 2: 30-Second Disconnection  
**Symptoms:** Client connects but disconnects after ~30 seconds
**Debug Output:** `LIKELY CAUSE: 30-second authentication timeout triggered`
**Solution:** Authentication succeeded but socket.userId not set properly

### Issue 3: Immediate Disconnection
**Symptoms:** Client disconnects immediately
**Debug Output:** `LIKELY CAUSE: Authentication middleware rejected connection`
**Solution:** Check token format, JWT secret, or middleware errors

### Issue 4: Token Validation Failures
**Debug Output:**
```
❌ [AUTH-VALIDATION-FAILED] Socket abc123
   🚫 Error: JsonWebTokenError - invalid signature
   🔐 SIGNATURE INVALID - Check JWT secret key
```
**Solutions:**
- Verify JWT secret matches between client/server
- Check token wasn't corrupted during transport
- Ensure token was generated with correct secret

### Issue 5: Expired Tokens
**Debug Output:**
```
❌ [AUTH-VALIDATION-FAILED] Socket abc123
   🚫 Error: TokenExpiredError - jwt expired
   ⏰ TOKEN EXPIRED - Check token expiration time
```
**Solutions:**
- Generate fresh token
- Check server/client time synchronization
- Extend token expiration time

## 🔧 Configuration Adjustments

### Increase Authentication Timeout
In `config/.env`:
```
AUTH_TIMEOUT=60000  # 60 seconds instead of 30
```

### Enable More Verbose Logging
The debugger automatically provides detailed logs. For additional logging, modify `src/server.js`:
```javascript
// Add more detailed Socket.IO logging
const io = new Server(server, {
    cors: corsOptions,
    connectionStateRecovery: {},
    // Add debug logging
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    // Log all events
    serveClient: true
});
```

## 📝 Testing Scenarios

### Test 1: Valid Authentication
1. Run `npm run debug:auth`
2. Copy the "Valid Token (1 hour)"
3. Connect with Socket.IO client
4. Should see successful authentication flow

### Test 2: Expired Token
1. Use the "Expired Token" from debug:auth
2. Should see token validation failure
3. Client should disconnect after 5 seconds

### Test 3: No Token
1. Connect without token: `io('http://localhost:3001')`
2. Should see "NO_TOKEN" error
3. Immediate disconnection

### Test 4: Invalid Token
1. Use malformed token: `"invalid.token.here"`
2. Should see JWT parsing error
3. Disconnection after 5 seconds

## 🎯 Next Steps

1. **Run the debugger**: `npm start` and `npm run debug:auth`
2. **Test with generated tokens** to verify authentication flow
3. **Check the detailed logs** to identify the exact failure point
4. **Review JWT token validity** and server configuration
5. **Monitor the 30-second summaries** for patterns

The enhanced debugging will show you exactly where in the authentication process the failure occurs!
