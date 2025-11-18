# JWT Token Generation Guide

## ❌ The Problem: Audience Invalid Error

```
jwt audience invalid. expected: servicedesk-client
```

This error occurs when your JWT token is **not generated with the correct claims** required by the server.

## ✅ Solution: Generate Tokens Correctly

### Required JWT Claims

Your JWT token **MUST** include these claims:

```javascript
{
  // Required claims (enforced by server)
  "user_id": 123,                    // ✅ MUST be a numeric integer (not "user123")
  "connection_id": "abc123...",      // ✅ Unique connection identifier
  "iss": "servicedesk-server",       // ✅ MUST match server expectation
  "aud": "servicedesk-client",       // ✅ MUST match server expectation
  "exp": 1700000000,                 // ✅ Expiration timestamp (required)
  "iat": 1699996400,                 // ✅ Issued at timestamp (required)
  
  // Optional but recommended
  "username": "john.doe",
  "full_name": "John Doe",
  "is_admin": false,
  "jti": "unique-jwt-id"             // For revocation (future use)
}
```

## 🔧 Option 1: Use Server's TokenGenerator (Recommended)

The server includes a built-in token generator utility:

### On Server (Node.js)

```javascript
const TokenGenerator = require('./src/utils/TokenGenerator');
const config = require('./src/utils/config');

// Initialize with server's JWT secret
const generator = new TokenGenerator(config.jwt.secret);

// Generate token - NOTE: userId MUST be numeric
const tokenData = generator.generateConnectionToken(
    123,              // userId - MUST be number, not "user123"
    'john.doe',       // username
    {
        fullName: 'John Doe',
        isAdmin: false,
        expiresIn: '1h'  // Token validity
    }
);

console.log('Token:', tokenData.token);
console.log('Expires in:', tokenData.expires_in);
console.log('Connection ID:', tokenData.payload.connection_id);

// Send this token to your client
```

### Generate Test Tokens via CLI

```bash
# Generate multiple test tokens
node src/utils/TokenGenerator.js

# Or use the npm script
npm run debug:auth
```

This will output valid tokens you can copy/paste into your client.

## 🔧 Option 2: Generate from Your Backend

If you're generating tokens from your own backend (PHP, Python, etc.), ensure:

### Example: Node.js/JavaScript

```javascript
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const secret = 'your-jwt-secret-key-must-match-server';

const token = jwt.sign(
    {
        user_id: 123,                                    // ✅ Numeric integer
        connection_id: crypto.randomBytes(16).toString('hex'),
        username: 'john.doe',
        full_name: 'John Doe',
        is_admin: false,
        jti: crypto.randomBytes(16).toString('hex')
    },
    secret,
    {
        issuer: 'servicedesk-server',     // ✅ REQUIRED
        audience: 'servicedesk-client',   // ✅ REQUIRED
        expiresIn: '1h',
        algorithm: 'HS256'                 // ✅ REQUIRED
    }
);

console.log('Generated token:', token);
```

### Example: PHP

```php
<?php
use Firebase\JWT\JWT;

$secret = 'your-jwt-secret-key-must-match-server';

$payload = [
    'user_id' => 123,                              // ✅ Integer
    'connection_id' => bin2hex(random_bytes(16)),
    'username' => 'john.doe',
    'full_name' => 'John Doe',
    'is_admin' => false,
    'jti' => bin2hex(random_bytes(16)),
    'iss' => 'servicedesk-server',                 // ✅ REQUIRED
    'aud' => 'servicedesk-client',                 // ✅ REQUIRED
    'exp' => time() + 3600,                        // ✅ 1 hour from now
    'iat' => time()                                // ✅ Issued now
];

$token = JWT::encode($payload, $secret, 'HS256');

echo "Generated token: " . $token;
```

### Example: Python

```python
import jwt
import secrets
import time

secret = 'your-jwt-secret-key-must-match-server'

payload = {
    'user_id': 123,                                  # ✅ Integer
    'connection_id': secrets.token_hex(16),
    'username': 'john.doe',
    'full_name': 'John Doe',
    'is_admin': False,
    'jti': secrets.token_hex(16),
    'iss': 'servicedesk-server',                     # ✅ REQUIRED
    'aud': 'servicedesk-client',                     # ✅ REQUIRED
    'exp': int(time.time()) + 3600,                  # ✅ 1 hour from now
    'iat': int(time.time())                          # ✅ Issued now
}

token = jwt.encode(payload, secret, algorithm='HS256')

print(f"Generated token: {token}")
```

## 🔑 JWT Secret Management

The JWT secret **MUST match** between:
- Token generator (your backend)
- Socket.IO server validation

### Configure Server Secret

In `config/.env`:

```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

⚠️ **Security Requirements:**
- Minimum 32 characters (enforced by server)
- Use cryptographically random string
- Never commit to version control
- Rotate periodically in production

### Generate Strong Secret

```bash
# Linux/Mac
openssl rand -base64 48

# Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# PowerShell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

## 🔄 Client Integration

### Updated Client Code

```javascript
// Get token from your backend API
const response = await fetch('/api/auth/get-socket-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 123 })  // Your user ID
});

const { token } = await response.json();

// Connect with properly formatted token
const socket = io('http://localhost:3001', {
    auth: {
        token: token  // ✅ Token with correct audience
    },
    transports: ['websocket', 'polling']
});

// Handle authentication success
socket.on('authenticated', (data) => {
    console.log('✅ Authenticated:', data);
});

// Handle authentication failure
socket.on('authentication_failed', (error) => {
    console.error('❌ Auth failed:', error);
    
    // Check for audience error
    if (error.message.includes('audience invalid')) {
        console.error('Token was not generated with audience: servicedesk-client');
    }
});
```

## 🧪 Testing Your Token

### Verify Token Claims

Use online tool: https://jwt.io

Or decode programmatically:

```javascript
const jwt = require('jsonwebtoken');

// Decode WITHOUT verification (just to inspect)
const decoded = jwt.decode(yourToken, { complete: true });

console.log('Header:', decoded.header);
console.log('Payload:', decoded.payload);

// Check required fields
console.log('Issuer:', decoded.payload.iss);        // Must be: servicedesk-server
console.log('Audience:', decoded.payload.aud);      // Must be: servicedesk-client
console.log('User ID type:', typeof decoded.payload.user_id);  // Must be: number
console.log('User ID value:', decoded.payload.user_id);        // Must be: >= 0
```

### Test Connection

```bash
# Generate test token
npm run debug:auth

# Copy token from output
# Update your client code with the token
# Connect and check server logs
```

## ⚠️ Common Mistakes

### ❌ Wrong user_id type
```javascript
// WRONG - String
{ user_id: "user123" }  // Server will reject: NaN

// CORRECT - Number
{ user_id: 123 }
```

### ❌ Missing or wrong audience
```javascript
// WRONG - No audience
jwt.sign(payload, secret, { expiresIn: '1h' })

// WRONG - Wrong audience
jwt.sign(payload, secret, { audience: 'myapp', ... })

// CORRECT
jwt.sign(payload, secret, { 
    audience: 'servicedesk-client',  // ✅ Must match
    issuer: 'servicedesk-server',
    expiresIn: '1h'
})
```

### ❌ Wrong secret
```javascript
// Token generated with: 'secret123'
// Server configured with: 'secret456'
// Result: "invalid signature" error
```

### ❌ Token in query string (deprecated)
```javascript
// WRONG - Deprecated for security
io('http://localhost:3001?token=abc...')

// CORRECT - Use auth object
io('http://localhost:3001', {
    auth: { token: 'abc...' }
})
```

## 📋 Checklist

Before connecting your client:

- [ ] Token has `iss: "servicedesk-server"`
- [ ] Token has `aud: "servicedesk-client"`
- [ ] Token has `user_id` as **number** (not string)
- [ ] Token has `connection_id` (non-empty string)
- [ ] Token has `exp` (expiration) timestamp
- [ ] Token has `iat` (issued at) timestamp
- [ ] JWT secret matches between generator and server
- [ ] Token passed via `auth.token` (not query string)
- [ ] Client handles `authenticated` event
- [ ] Client handles `authentication_failed` event

## 🆘 Still Having Issues?

1. **Enable debug mode** in server:
   ```env
   DEBUG_MODE=true
   ```

2. **Check server logs** for detailed error:
   - Token length
   - Token preview (first 50 chars)
   - Exact validation error

3. **Decode your token** at jwt.io and verify all claims

4. **Generate fresh token** using `npm run debug:auth`

5. **Verify secret** matches in both token generator and server config
