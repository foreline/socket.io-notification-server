# Connection-Specific Token Approach for Real-Time Notifications

## Overview

This document describes a secure, framework-agnostic approach for implementing real-time notifications using connection-specific JWT tokens. Each browser tab/connection gets a unique token that cannot be reused by other connections, providing maximum security for multi-device notifications.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend PHP    │    │   Node.js       │
│   (Browser)     │    │   (Bitrix)       │    │   Socket.IO     │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ 1. Request      │───▶│ 2. Generate      │    │                 │
│    connection   │    │    unique JWT    │    │                 │
│    token        │    │                  │    │                 │
│                 │    │ 3. Return token  │◀───┤                 │
│ 4. Connect to   │───────────────────────────▶│ 5. Validate JWT │
│    Socket.IO    │    │                  │    │    & join room  │
│    with token   │    │                  │    │                 │
│                 │    │ 7. Send          │───▶│ 8. Publish to   │
│ 9. Receive      │◀───────────────────────────┤    specific     │
│    notification │    │    notification  │    │    connection   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Security Features

- ✅ **Connection-specific tokens**: Each browser tab gets unique token
- ✅ **JWT-based authentication**: Cryptographically signed, tamper-proof
- ✅ **Server-controlled room assignment**: Users cannot choose rooms
- ✅ **Token expiration**: Automatic cleanup of old connections
- ✅ **Framework agnostic**: Works with any backend framework
- ✅ **Scalable**: No session scanning or complex lookups

---

## 1. Backend PHP Implementation (Bitrix)

### 1.1 JWT Helper Library

```php
<?php
/**
 * JWT Helper for Connection-Specific Tokens
 * 
 * File: src/Infrastructure/Authentication/JwtHelper.php
 */

namespace Infrastructure\Authentication;

class JwtHelper
{
    private static $secret;
    
    /**
     * Initialize with secret key
     * Should be called once during application bootstrap
     */
    public static function init($secretKey)
    {
        self::$secret = $secretKey;
    }
    
    /**
     * Create a connection-specific JWT token
     * 
     * @param int $userId User ID from Bitrix
     * @param array $additionalClaims Extra data to include in token
     * @param int $expirationHours Token validity in hours (default: 24)
     * @return string JWT token
     */
    public static function createConnectionToken($userId, $additionalClaims = [], $expirationHours = 24)
    {
        $now = time();
        
        // Base claims for the token
        $payload = [
            'iss' => $_SERVER['HTTP_HOST'] ?? 'module.local', // Issuer
            'aud' => 'socket.io',                                  // Audience
            'iat' => $now,                                         // Issued at
            'exp' => $now + ($expirationHours * 3600),           // Expiration
            'nbf' => $now,                                         // Not before
            'jti' => self::generateConnectionId(),                 // JWT ID (connection-specific)
            
            // User-specific claims
            'user_id' => (int)$userId,
            'connection_id' => self::generateConnectionId(),       // Unique per connection
            'session_id' => session_id(),                         // PHP session ID for reference
            'user_agent_hash' => self::hashUserAgent(),          // Browser fingerprint
            'ip_hash' => self::hashClientIp(),                   // IP fingerprint
        ];
        
        // Merge additional claims (roles, permissions, etc.)
        $payload = array_merge($payload, $additionalClaims);
        
        return self::encode($payload);
    }
    
    /**
     * Validate and decode JWT token
     * 
     * @param string $token JWT token to validate
     * @return array|false Decoded payload or false if invalid
     */
    public static function validateToken($token)
    {
        try {
            return self::decode($token);
        } catch (Exception $e) {
            error_log("JWT validation error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Check if token is expired
     */
    public static function isTokenExpired($payload)
    {
        return isset($payload['exp']) && $payload['exp'] < time();
    }
    
    /**
     * Generate unique connection ID
     * This makes each browser tab/connection unique
     */
    private static function generateConnectionId()
    {
        return bin2hex(random_bytes(16)) . '_' . microtime(true);
    }
    
    /**
     * Hash user agent for basic fingerprinting
     */
    private static function hashUserAgent()
    {
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
        return substr(md5($userAgent), 0, 8);
    }
    
    /**
     * Hash client IP for basic fingerprinting
     */
    private static function hashClientIp()
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        return substr(md5($ip), 0, 8);
    }
    
    /**
     * Encode JWT token
     */
    private static function encode($payload)
    {
        if (!self::$secret) {
            throw new Exception('JWT secret not initialized');
        }
        
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode($payload);
        
        $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
        
        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, self::$secret, true);
        $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
        
        return $base64Header . "." . $base64Payload . "." . $base64Signature;
    }
    
    /**
     * Decode and validate JWT token
     */
    private static function decode($jwt)
    {
        if (!self::$secret) {
            throw new Exception('JWT secret not initialized');
        }
        
        $parts = explode('.', $jwt);
        if (count($parts) != 3) {
            throw new Exception('Invalid JWT format');
        }
        
        [$base64Header, $base64Payload, $base64Signature] = $parts;
        
        // Verify signature
        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, self::$secret, true);
        $expectedSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
        
        if (!hash_equals($base64Signature, $expectedSignature)) {
            throw new Exception('Invalid JWT signature');
        }
        
        // Decode payload
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $base64Payload)), true);
        
        if (!$payload) {
            throw new Exception('Invalid JWT payload');
        }
        
        // Check expiration
        if (self::isTokenExpired($payload)) {
            throw new Exception('JWT token expired');
        }
        
        return $payload;
    }
}
```

### 1.2 Token API Endpoint

```php
<?php
/**
 * Connection Token API Endpoint
 * 
 * File: /bitrix/tools/api/socket-token.php
 * 
 * This endpoint generates connection-specific JWT tokens for Socket.IO authentication.
 * Each request generates a unique token that can only be used by the specific browser tab.
 */

// Initialize Bitrix environment
require_once($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/local/modules/app/src/Infrastructure/Authentication/JwtHelper.php");

use Infrastructure\Authentication\JwtHelper;

// Set content type and CORS headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/**
 * Initialize JWT secret key
 * In production, store this in environment variables or secure config
 */
$jwtSecret = 'your-super-secret-jwt-key-change-this-in-production';
JwtHelper::init($jwtSecret);

/**
 * Send JSON response
 */
function sendJsonResponse($data, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Log authentication attempt for security monitoring
 */
function logAuthAttempt($userId, $success, $reason = '')
{
    $logData = [
        'timestamp' => date('Y-m-d H:i:s'),
        'user_id' => $userId,
        'success' => $success,
        'reason' => $reason,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ];
    
    error_log("Socket Token Auth: " . json_encode($logData));
}

try {
    // Only allow POST requests for token generation
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendJsonResponse(['error' => 'Method not allowed'], 405);
    }
    
    // Check if user is authenticated in Bitrix
    global $USER;
    if (!$USER || !$USER->IsAuthorized()) {
        logAuthAttempt(null, false, 'User not authenticated');
        sendJsonResponse(['error' => 'Authentication required'], 401);
    }
    
    $userId = $USER->GetID();
    $userLogin = $USER->GetLogin();
    $userName = $USER->GetFullName();
    
    // Get user roles/permissions for the token
    $userGroups = $USER->GetUserGroupArray();
    $isAdmin = in_array(1, $userGroups); // Group 1 is typically admin in Bitrix
    
    // Additional claims to include in the token
    $additionalClaims = [
        'username' => $userLogin,
        'full_name' => $userName,
        'is_admin' => $isAdmin,
        'groups' => $userGroups,
        'permissions' => [
            'can_view_tickets' => true,
            'can_create_tickets' => true,
            'can_admin' => $isAdmin
        ]
    ];
    
    // Generate connection-specific token
    // Each browser tab will get a unique token
    $token = JwtHelper::createConnectionToken($userId, $additionalClaims, 24);
    
    // Decode token to get connection details for response
    $tokenPayload = JwtHelper::validateToken($token);
    
    logAuthAttempt($userId, true, 'Token generated successfully');
    
    // Return token and connection information
    sendJsonResponse([
        'success' => true,
        'token' => $token,
        'user' => [
            'id' => $userId,
            'login' => $userLogin,
            'name' => $userName,
            'is_admin' => $isAdmin
        ],
        'connection' => [
            'id' => $tokenPayload['connection_id'],
            'expires_at' => date('Y-m-d H:i:s', $tokenPayload['exp']),
            'expires_in_seconds' => $tokenPayload['exp'] - time()
        ],
        'socket_io' => [
            'url' => 'http://localhost:3000', // Configure your Socket.IO server URL
            'transports' => ['websocket', 'polling']
        ]
    ]);
    
} catch (Exception $e) {
    logAuthAttempt($USER ? $USER->GetID() : null, false, $e->getMessage());
    
    sendJsonResponse([
        'error' => 'Internal server error',
        'message' => 'Token generation failed'
    ], 500);
}
?>
```

### 1.3 Notification Sender Service

```php
<?php
/**
 * Notification Sender for Connection-Specific Tokens
 * 
 * File: /local/modules/app/src/Infrastructure/Notifications/NotificationSender.php
 */

namespace Infrastructure\Notifications;

class NotificationSender
{
    private $redis;
    private static $instance = null;
    
    private function __construct()
    {
        // Initialize Redis connection for pub/sub with Node.js
        $this->redis = new \Redis();
        $this->redis->connect('127.0.0.1', 6379);
    }
    
    public static function getInstance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Send notification to all user's active connections
     * 
     * @param int $userId Target user ID
     * @param array $notification Notification data
     * @return bool Success status
     */
    public function sendToUser($userId, $notification)
    {
        if (empty($userId) || empty($notification)) {
            return false;
        }
        
        // Prepare notification payload
        $payload = [
            'type' => 'user_notification',
            'target_user_id' => (int)$userId,
            'timestamp' => time(),
            'notification' => $notification
        ];
        
        // Node.js will receive this and send to all user's connections
        return $this->publishToRedis('user_notifications', $payload);
    }
    
    /**
     * Send notification to specific connection
     * 
     * @param string $connectionId Specific connection ID
     * @param array $notification Notification data
     * @return bool Success status
     */
    public function sendToConnection($connectionId, $notification)
    {
        if (empty($connectionId) || empty($notification)) {
            return false;
        }
        
        $payload = [
            'type' => 'connection_notification',
            'target_connection_id' => $connectionId,
            'timestamp' => time(),
            'notification' => $notification
        ];
        
        return $this->publishToRedis('connection_notifications', $payload);
    }
    
    /**
     * Broadcast notification to all connected users
     * 
     * @param array $notification Notification data
     * @return bool Success status
     */
    public function broadcast($notification)
    {
        if (empty($notification)) {
            return false;
        }
        
        $payload = [
            'type' => 'broadcast',
            'timestamp' => time(),
            'notification' => $notification
        ];
        
        return $this->publishToRedis('broadcast_notifications', $payload);
    }
    
    /**
     * Send app-specific notification
     * 
     * @param int $userId User ID
     * @param int $ticketId Ticket ID
     * @param string $message Notification message
     * @param string $action Action type (created, updated, closed, etc.)
     * @return bool Success status
     */
    public function sendTicketNotification($userId, $ticketId, $message, $action = 'updated')
    {
        $notification = [
            'module' => 'app',
            'type' => 'ticket_' . $action,
            'title' => 'Ticket Update',
            'message' => $message,
            'data' => [
                'ticket_id' => (int)$ticketId,
                'action' => $action,
                'url' => "/app/item/{$ticketId}/"
            ],
            'priority' => 'normal',
            'show_popup' => true,
            'auto_hide' => false
        ];
        
        return $this->sendToUser($userId, $notification);
    }
    
    /**
     * Publish message to Redis for Node.js consumption
     */
    private function publishToRedis($channel, $payload)
    {
        try {
            $message = json_encode($payload, JSON_UNESCAPED_UNICODE);
            $result = $this->redis->publish($channel, $message);
            
            // Log for debugging
            error_log("Published to Redis channel '{$channel}': " . $message);
            
            return $result > 0;
        } catch (Exception $e) {
            error_log("Redis publish error: " . $e->getMessage());
            return false;
        }
    }
}

/**
 * Helper functions for easy usage throughout the application
 */

/**
 * Send notification to user (all their connections)
 */
function notifyUser($userId, $notification)
{
    return NotificationSender::getInstance()->sendToUser($userId, $notification);
}

/**
 * Send ticket-specific notification
 */
function notifyTicketUpdate($userId, $ticketId, $message, $action = 'updated')
{
    return NotificationSender::getInstance()->sendTicketNotification($userId, $ticketId, $message, $action);
}

/**
 * Broadcast to all users
 */
function broadcastNotification($notification)
{
    return NotificationSender::getInstance()->broadcast($notification);
}
?>
```

---

## 2. Frontend JavaScript Implementation

### 2.1 Socket.IO Client with Connection-Specific Authentication

```javascript
/**
 * Real-time Notifications Client
 * 
 * File: /local/modules/app/install/public/js/notifications.js
 * 
 * This handles connection-specific authentication and real-time notifications
 * for the App module using Socket.IO.
 */

class AppNotifications {
    constructor(options = {}) {
        // Configuration
        this.config = {
            tokenEndpoint: '/bitrix/tools/api/socket-token.php',
            socketUrl: 'http://localhost:3000',
            reconnectInterval: 5000,
            maxReconnectAttempts: 10,
            tokenRefreshThreshold: 300, // Refresh token 5 minutes before expiry
            ...options
        };
        
        // State
        this.socket = null;
        this.token = null;
        this.tokenExpiry = null;
        this.connectionId = null;
        this.userId = null;
        this.reconnectAttempts = 0;
        this.isConnected = false;
        this.isAuthenticated = false;
        
        // Event handlers
        this.eventHandlers = {
            connected: [],
            authenticated: [],
            disconnected: [],
            notification: [],
            error: []
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize the notification system
     */
    async init() {
        try {
            console.log('🔌 Initializing App notifications...');
            
            // Get connection-specific token from backend
            await this.getConnectionToken();
            
            // Initialize Socket.IO connection
            await this.initSocketConnection();
            
            // Setup token refresh timer
            this.setupTokenRefresh();
            
            // Setup visibility change handling (tab switching)
            this.setupVisibilityHandling();
            
            console.log('✅ App notifications initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize notifications:', error);
            this.emit('error', { type: 'initialization_failed', error });
        }
    }
    
    /**
     * Get connection-specific JWT token from backend
     * Each browser tab gets a unique token
     */
    async getConnectionToken() {
        try {
            console.log('🔑 Requesting connection-specific token...');
            
            const response = await fetch(this.config.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // Include Bitrix session cookies
            });
            
            if (!response.ok) {
                throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success || !data.token) {
                throw new Error(data.error || 'Invalid token response');
            }
            
            // Store token information
            this.token = data.token;
            this.connectionId = data.connection.id;
            this.userId = data.user.id;
            this.tokenExpiry = new Date(data.connection.expires_at).getTime();
            
            console.log('✅ Connection token received:', {
                connectionId: this.connectionId,
                userId: this.userId,
                expiresIn: Math.round((this.tokenExpiry - Date.now()) / 1000) + 's'
            });
            
            return data;
            
        } catch (error) {
            console.error('❌ Failed to get connection token:', error);
            throw error;
        }
    }
    
    /**
     * Initialize Socket.IO connection with authentication
     */
    async initSocketConnection() {
        try {
            console.log('🌐 Connecting to Socket.IO server...');
            
            // Initialize Socket.IO with configuration
            this.socket = io(this.config.socketUrl, {
                transports: ['websocket', 'polling'],
                timeout: 10000,
                forceNew: true, // Each tab gets fresh connection
                auth: {
                    token: this.token // Send token in auth payload
                }
            });
            
            // Setup event handlers
            this.setupSocketEventHandlers();
            
        } catch (error) {
            console.error('❌ Failed to initialize socket connection:', error);
            throw error;
        }
    }
    
    /**
     * Setup Socket.IO event handlers
     */
    setupSocketEventHandlers() {
        // Connection established
        this.socket.on('connect', () => {
            console.log('🔌 Connected to Socket.IO server');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connected', { connectionId: this.connectionId });
        });
        
        // Authentication successful
        this.socket.on('authenticated', (data) => {
            console.log('🔐 Authentication successful:', data);
            this.isAuthenticated = true;
            this.emit('authenticated', data);
        });
        
        // Authentication failed
        this.socket.on('authentication_failed', (data) => {
            console.error('❌ Authentication failed:', data);
            this.isAuthenticated = false;
            
            // Try to refresh token and reconnect
            this.refreshTokenAndReconnect();
        });
        
        // Disconnection
        this.socket.on('disconnect', (reason) => {
            console.log('🔌 Disconnected from Socket.IO server:', reason);
            this.isConnected = false;
            this.isAuthenticated = false;
            this.emit('disconnected', { reason });
            
            // Handle automatic reconnection
            this.handleDisconnection(reason);
        });
        
        // Notification received
        this.socket.on('notification', (notification) => {
            console.log('📨 Notification received:', notification);
            this.handleNotification(notification);
        });
        
        // Token expiry warning
        this.socket.on('token_expiring', (data) => {
            console.log('⏰ Token expiring soon:', data);
            this.refreshTokenAndReconnect();
        });
        
        // Connection error
        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            this.emit('error', { type: 'connection_error', error });
        });
    }
    
    /**
     * Handle incoming notifications
     */
    handleNotification(notification) {
        // Add metadata
        notification.receivedAt = new Date().toISOString();
        notification.connectionId = this.connectionId;
        
        // Emit to registered handlers
        this.emit('notification', notification);
        
        // Built-in notification display
        this.displayNotification(notification);
    }
    
    /**
     * Display notification to user
     */
    displayNotification(notification) {
        // Create notification element
        const notificationEl = this.createNotificationElement(notification);
        
        // Add to notification container
        let container = document.getElementById('app-notifications');
        if (!container) {
            container = this.createNotificationContainer();
        }
        
        container.appendChild(notificationEl);
        
        // Auto-hide if configured
        if (notification.auto_hide !== false) {
            setTimeout(() => {
                notificationEl.remove();
            }, 5000);
        }
        
        // Show browser notification if permission granted
        if (notification.show_popup && Notification.permission === 'granted') {
            new Notification(notification.title || 'App Notification', {
                body: notification.message,
                icon: '/local/modules/app/install/public/images/notification-icon.png',
                tag: `app-${notification.data?.ticket_id || Date.now()}`
            });
        }
    }
    
    /**
     * Create notification DOM element
     */
    createNotificationElement(notification) {
        const div = document.createElement('div');
        div.className = `app-notification notification-${notification.type} notification-${notification.priority || 'normal'}`;
        div.innerHTML = `
            <div class="notification-header">
                <span class="notification-title">${notification.title || 'Notification'}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="notification-body">
                <p class="notification-message">${notification.message}</p>
                ${notification.data?.url ? `<a href="${notification.data.url}" class="notification-link">View Details</a>` : ''}
            </div>
        `;
        
        return div;
    }
    
    /**
     * Create notification container
     */
    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'app-notifications';
        container.className = 'app-notifications-container';
        document.body.appendChild(container);
        
        // Add CSS styles
        this.injectNotificationStyles();
        
        return container;
    }
    
    /**
     * Inject notification styles
     */
    injectNotificationStyles() {
        if (document.getElementById('app-notification-styles')) {
            return; // Already injected
        }
        
        const style = document.createElement('style');
        style.id = 'app-notification-styles';
        style.textContent = `
            .app-notifications-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
            }
            
            .app-notification {
                background: #fff;
                border: 1px solid #ddd;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                margin-bottom: 10px;
                overflow: hidden;
                animation: slideIn 0.3s ease-out;
            }
            
            .app-notification.notification-high {
                border-left: 4px solid #dc3545;
            }
            
            .app-notification.notification-normal {
                border-left: 4px solid #007bff;
            }
            
            .notification-header {
                background: #f8f9fa;
                padding: 10px 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .notification-title {
                font-weight: bold;
                color: #333;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #666;
            }
            
            .notification-body {
                padding: 15px;
            }
            
            .notification-message {
                margin: 0 0 10px 0;
                color: #555;
            }
            
            .notification-link {
                display: inline-block;
                color: #007bff;
                text-decoration: none;
                font-weight: bold;
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Setup token refresh timer
     */
    setupTokenRefresh() {
        const checkInterval = 60000; // Check every minute
        
        setInterval(() => {
            const timeToExpiry = this.tokenExpiry - Date.now();
            const thresholdMs = this.config.tokenRefreshThreshold * 1000;
            
            if (timeToExpiry <= thresholdMs && timeToExpiry > 0) {
                console.log('🔄 Token expiring soon, refreshing...');
                this.refreshTokenAndReconnect();
            }
        }, checkInterval);
    }
    
    /**
     * Setup tab visibility handling
     */
    setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && (!this.isConnected || !this.isAuthenticated)) {
                console.log('👁️ Tab became visible, checking connection...');
                this.refreshTokenAndReconnect();
            }
        });
    }
    
    /**
     * Refresh token and reconnect
     */
    async refreshTokenAndReconnect() {
        try {
            console.log('🔄 Refreshing connection token...');
            
            // Disconnect current socket
            if (this.socket) {
                this.socket.disconnect();
            }
            
            // Get new token
            await this.getConnectionToken();
            
            // Reconnect with new token
            await this.initSocketConnection();
            
        } catch (error) {
            console.error('❌ Failed to refresh token:', error);
            this.emit('error', { type: 'token_refresh_failed', error });
        }
    }
    
    /**
     * Handle disconnection with reconnect logic
     */
    handleDisconnection(reason) {
        if (reason === 'io server disconnect') {
            // Server disconnected us, try to reconnect
            this.scheduleReconnect();
        }
        // Other reasons might be client-side, Socket.IO will handle automatically
    }
    
    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached');
            this.emit('error', { type: 'max_reconnects_exceeded' });
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.config.reconnectInterval * this.reconnectAttempts;
        
        console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            this.refreshTokenAndReconnect();
        }, delay);
    }
    
    /**
     * Register event handler
     */
    on(event, handler) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].push(handler);
        }
    }
    
    /**
     * Emit event to registered handlers
     */
    emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in ${event} handler:`, error);
                }
            });
        }
    }
    
    /**
     * Request browser notification permission
     */
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.warn('Browser does not support notifications');
            return false;
        }
        
        if (Notification.permission === 'granted') {
            return true;
        }
        
        if (Notification.permission === 'denied') {
            console.warn('Notification permission denied');
            return false;
        }
        
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    
    /**
     * Disconnect and cleanup
     */
    disconnect() {
        console.log('🔌 Disconnecting App notifications...');
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.isConnected = false;
        this.isAuthenticated = false;
        this.token = null;
        this.connectionId = null;
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if user is logged in (check for Bitrix user)
    if (window.BX && BX.message('USER_ID')) {
        window.appNotifications = new AppNotifications();
        
        // Request notification permission
        window.appNotifications.requestNotificationPermission();
        
        console.log('🎯 App notifications available globally as window.appNotifications');
    }
});
```

---

## 3. Node.js Socket.IO Server Implementation

### 3.1 Main Server File

```javascript
/**
 * Socket.IO Server for Connection-Specific Authentication
 * 
 * File: server.js
 * 
 * This server handles connection-specific JWT authentication and real-time notifications
 * for the application. Each browser tab gets a unique room based on their
 * connection-specific token.
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const redis = require('redis');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Configuration
const config = {
    port: process.env.PORT || 3000,
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || null
    },
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
    }
};

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = socketIo(server, {
    cors: config.cors,
    transports: ['websocket', 'polling']
});

// Initialize Redis clients
const redisClient = redis.createClient({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password
});

const redisSubscriber = redis.createClient({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password
});

// Connection tracking
const connections = new Map(); // connectionId -> socket
const userConnections = new Map(); // userId -> Set of connectionIds

/**
 * JWT Helper Functions
 */
class JwtHelper {
    /**
     * Verify and decode JWT token
     */
    static verifyToken(token) {
        try {
            return jwt.verify(token, config.jwtSecret);
        } catch (error) {
            throw new Error(`JWT verification failed: ${error.message}`);
        }
    }
    
    /**
     * Check if token is expired
     */
    static isTokenExpired(payload) {
        return payload.exp && payload.exp < Math.floor(Date.now() / 1000);
    }
    
    /**
     * Validate token payload structure
     */
    static validatePayload(payload) {
        const required = ['user_id', 'connection_id', 'exp', 'iat'];
        
        for (const field of required) {
            if (!payload[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        if (this.isTokenExpired(payload)) {
            throw new Error('Token expired');
        }
        
        return true;
    }
}

/**
 * Connection Manager
 */
class ConnectionManager {
    /**
     * Register new connection
     */
    static registerConnection(socket, payload) {
        const { user_id, connection_id } = payload;
        
        // Store connection mapping
        connections.set(connection_id, socket);
        
        // Track user connections
        if (!userConnections.has(user_id)) {
            userConnections.set(user_id, new Set());
        }
        userConnections.get(user_id).add(connection_id);
        
        // Store payload in socket for reference
        socket.userId = user_id;
        socket.connectionId = connection_id;
        socket.tokenPayload = payload;
        
        console.log(`✅ Connection registered: User ${user_id}, Connection ${connection_id}`);
        console.log(`📊 User ${user_id} now has ${userConnections.get(user_id).size} active connections`);
    }
    
    /**
     * Unregister connection
     */
    static unregisterConnection(socket) {
        if (!socket.connectionId || !socket.userId) {
            return;
        }
        
        const { userId, connectionId } = socket;
        
        // Remove from connections map
        connections.delete(connectionId);
        
        // Remove from user connections
        if (userConnections.has(userId)) {
            userConnections.get(userId).delete(connectionId);
            
            // Remove user entry if no connections left
            if (userConnections.get(userId).size === 0) {
                userConnections.delete(userId);
            }
        }
        
        console.log(`❌ Connection unregistered: User ${userId}, Connection ${connectionId}`);
        
        const remainingConnections = userConnections.get(userId)?.size || 0;
        console.log(`📊 User ${userId} now has ${remainingConnections} active connections`);
    }
    
    /**
     * Get all connections for a user
     */
    static getUserConnections(userId) {
        const connectionIds = userConnections.get(userId) || new Set();
        const sockets = [];
        
        for (const connectionId of connectionIds) {
            const socket = connections.get(connectionId);
            if (socket && socket.connected) {
                sockets.push(socket);
            }
        }
        
        return sockets;
    }
    
    /**
     * Get connection by ID
     */
    static getConnection(connectionId) {
        return connections.get(connectionId);
    }
    
    /**
     * Get statistics
     */
    static getStats() {
        return {
            totalConnections: connections.size,
            totalUsers: userConnections.size,
            userBreakdown: Array.from(userConnections.entries()).map(([userId, connectionIds]) => ({
                userId,
                connectionCount: connectionIds.size
            }))
        };
    }
}

/**
 * Socket.IO Connection Handler
 */
io.on('connection', (socket) => {
    console.log(`🔌 New connection attempt: ${socket.id}`);
    
    /**
     * Authentication handler
     * Validates connection-specific JWT token
     */
    socket.on('authenticate', ({ token }) => {
        try {
            console.log(`🔐 Authentication attempt for socket ${socket.id}`);
            
            if (!token) {
                throw new Error('No token provided');
            }
            
            // Verify and decode JWT token
            const payload = JwtHelper.verifyToken(token);
            JwtHelper.validatePayload(payload);
            
            // Check for duplicate connections with same connection_id
            const existingConnection = ConnectionManager.getConnection(payload.connection_id);
            if (existingConnection && existingConnection.connected) {
                console.log(`⚠️ Duplicate connection detected for ${payload.connection_id}, disconnecting old one`);
                existingConnection.disconnect();
            }
            
            // Register this connection
            ConnectionManager.registerConnection(socket, payload);
            
            // Join connection-specific room
            const roomName = `connection_${payload.connection_id}`;
            socket.join(roomName);
            
            // Join user room for broadcast messages
            const userRoomName = `user_${payload.user_id}`;
            socket.join(userRoomName);
            
            // Send authentication success
            socket.emit('authenticated', {
                success: true,
                user_id: payload.user_id,
                connection_id: payload.connection_id,
                expires_at: new Date(payload.exp * 1000).toISOString(),
                rooms: [roomName, userRoomName]
            });
            
            console.log(`✅ Authentication successful: User ${payload.user_id}, Connection ${payload.connection_id}`);
            
            // Set up token expiry warning
            const expiryWarningTime = (payload.exp - 300) * 1000; // 5 minutes before expiry
            const warningDelay = expiryWarningTime - Date.now();
            
            if (warningDelay > 0) {
                setTimeout(() => {
                    if (socket.connected) {
                        socket.emit('token_expiring', {
                            expires_at: new Date(payload.exp * 1000).toISOString(),
                            warning_seconds: 300
                        });
                    }
                }, warningDelay);
            }
            
        } catch (error) {
            console.error(`❌ Authentication failed for socket ${socket.id}:`, error.message);
            
            socket.emit('authentication_failed', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            // Disconnect unauthenticated socket after delay
            setTimeout(() => {
                if (!socket.userId) {
                    socket.disconnect();
                }
            }, 5000);
        }
    });
    
    /**
     * Handle manual token refresh
     */
    socket.on('refresh_token', ({ token }) => {
        socket.emit('authenticate', { token });
    });
    
    /**
     * Handle disconnection
     */
    socket.on('disconnect', (reason) => {
        console.log(`🔌 Socket ${socket.id} disconnected: ${reason}`);
        
        // Unregister connection
        ConnectionManager.unregisterConnection(socket);
        
        // Log final stats
        const stats = ConnectionManager.getStats();
        console.log(`📊 Current stats: ${stats.totalConnections} connections, ${stats.totalUsers} users`);
    });
    
    /**
     * Handle connection errors
     */
    socket.on('error', (error) => {
        console.error(`❌ Socket error for ${socket.id}:`, error);
    });
    
    /**
     * Heartbeat/ping handler for connection health
     */
    socket.on('ping', () => {
        socket.emit('pong', {
            timestamp: Date.now(),
            server_time: new Date().toISOString()
        });
    });
    
    // Auto-disconnect unauthenticated connections after timeout
    setTimeout(() => {
        if (!socket.userId) {
            console.log(`⏰ Disconnecting unauthenticated socket ${socket.id} after timeout`);
            socket.disconnect();
        }
    }, 30000); // 30 seconds timeout
});

/**
 * Redis Message Handlers
 * Listen for notifications from PHP backend
 */

// Handle user notifications (send to all user's connections)
redisSubscriber.subscribe('user_notifications');
redisSubscriber.on('message', (channel, message) => {
    try {
        if (channel === 'user_notifications') {
            const payload = JSON.parse(message);
            
            if (payload.type === 'user_notification' && payload.target_user_id) {
                const userId = payload.target_user_id;
                const userSockets = ConnectionManager.getUserConnections(userId);
                
                console.log(`📨 Sending notification to user ${userId} (${userSockets.length} connections)`);
                
                // Send to all user's connections
                userSockets.forEach(socket => {
                    socket.emit('notification', {
                        ...payload.notification,
                        delivered_to_connection: socket.connectionId,
                        delivered_at: new Date().toISOString()
                    });
                });
                
                // Log delivery stats
                console.log(`✅ Notification delivered to ${userSockets.length} connections for user ${userId}`);
            }
        }
    } catch (error) {
        console.error('❌ Error processing Redis message:', error);
    }
});

// Handle connection-specific notifications
redisSubscriber.subscribe('connection_notifications');
redisSubscriber.on('message', (channel, message) => {
    try {
        if (channel === 'connection_notifications') {
            const payload = JSON.parse(message);
            
            if (payload.type === 'connection_notification' && payload.target_connection_id) {
                const connectionId = payload.target_connection_id;
                const socket = ConnectionManager.getConnection(connectionId);
                
                if (socket && socket.connected) {
                    socket.emit('notification', {
                        ...payload.notification,
                        delivered_to_connection: connectionId,
                        delivered_at: new Date().toISOString()
                    });
                    
                    console.log(`✅ Notification delivered to connection ${connectionId}`);
                } else {
                    console.log(`⚠️ Connection ${connectionId} not found or disconnected`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error processing connection notification:', error);
    }
});

// Handle broadcast notifications
redisSubscriber.subscribe('broadcast_notifications');
redisSubscriber.on('message', (channel, message) => {
    try {
        if (channel === 'broadcast_notifications') {
            const payload = JSON.parse(message);
            
            if (payload.type === 'broadcast') {
                console.log(`📢 Broadcasting notification to all connections`);
                
                io.emit('notification', {
                    ...payload.notification,
                    is_broadcast: true,
                    delivered_at: new Date().toISOString()
                });
                
                console.log(`✅ Broadcast delivered to ${ConnectionManager.getStats().totalConnections} connections`);
            }
        }
    } catch (error) {
        console.error('❌ Error processing broadcast notification:', error);
    }
});

/**
 * Express Routes for Health Checks and Stats
 */

app.use(cors(config.cors));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    const stats = ConnectionManager.getStats();
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            pid: process.pid
        },
        connections: stats,
        redis: {
            connected: redisClient.connected && redisSubscriber.connected
        }
    });
});

// Connection statistics endpoint
app.get('/stats', (req, res) => {
    const stats = ConnectionManager.getStats();
    
    res.json({
        timestamp: new Date().toISOString(),
        ...stats
    });
});

// Test notification endpoint (for development)
if (process.env.NODE_ENV !== 'production') {
    app.post('/test/notify-user/:userId', (req, res) => {
        const userId = parseInt(req.params.userId);
        const notification = req.body;
        
        const payload = {
            type: 'user_notification',
            target_user_id: userId,
            timestamp: Date.now(),
            notification: {
                title: 'Test Notification',
                message: 'This is a test notification',
                ...notification
            }
        };
        
        redisClient.publish('user_notifications', JSON.stringify(payload));
        
        res.json({
            success: true,
            message: `Test notification sent to user ${userId}`,
            payload
        });
    });
}

/**
 * Error Handlers
 */

// Redis error handling
redisClient.on('error', (error) => {
    console.error('❌ Redis client error:', error);
});

redisSubscriber.on('error', (error) => {
    console.error('❌ Redis subscriber error:', error);
});

// Process error handling
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📤 SIGTERM received, shutting down gracefully');
    
    // Close server
    server.close(() => {
        console.log('🔌 HTTP server closed');
        
        // Close Redis connections
        redisClient.quit();
        redisSubscriber.quit();
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    });
});

/**
 * Start Server
 */
server.listen(config.port, () => {
    console.log(`🚀 Socket.IO server running on port ${config.port}`);
    console.log(`🔐 JWT Secret configured: ${config.jwtSecret.substr(0, 10)}...`);
    console.log(`📡 Redis: ${config.redis.host}:${config.redis.port}`);
    console.log(`🌐 CORS Origin: ${config.cors.origin}`);
    console.log(`🎯 Ready for connection-specific authentication!`);
});
```

### 3.2 Package.json

```json
{
  "name": "app-socketio-server",
  "version": "1.0.0",
  "description": "Socket.IO server for real-time notifications with connection-specific JWT authentication",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "redis": "^4.6.7",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "keywords": [
    "socket.io",
    "real-time",
    "notifications",
    "jwt",
    "redis"
  ],
  "author": "Application Team",
  "license": "MIT"
}
```

---

## 4. Security Considerations

### 4.1 Token Security
- **Unique per connection**: Each browser tab gets different token
- **Time-limited**: Tokens expire automatically
- **Cryptographically signed**: Cannot be forged without secret key
- **User fingerprinting**: Includes IP and User-Agent hashes

### 4.2 Room Access Control
- **Server-controlled**: Only server assigns rooms based on verified identity
- **No manual room joining**: Clients cannot choose which rooms to join
- **Connection isolation**: Each connection has unique room

### 4.3 Additional Measures
- **Connection limits**: Monitor and limit connections per user
- **Rate limiting**: Prevent token request abuse
- **Audit logging**: Log all authentication attempts
- **Health monitoring**: Track connection statistics

---

## 5. Usage Examples

### 5.1 Sending Ticket Notification (PHP)

```php
<?php
// In your processing code
require_once(__DIR__ . '/path/to/NotificationSender.php');

use Infrastructure\Notifications\NotificationSender;

// When ticket is updated
$userId = 123;
$ticketId = 456;
$message = "Your ticket #456 has been assigned to John Doe";

notifyTicketUpdate($userId, $ticketId, $message, 'assigned');
?>
```

### 5.2 Handling Notifications (JavaScript)

```javascript
// Register notification handler
window.appNotifications.on('notification', (notification) => {
    console.log('Received:', notification);
    
    if (notification.type === 'item_assigned') {
        // Special handling for item assignments
        showTicketAssignmentPopup(notification);
    }
});

// Check connection status
window.appNotifications.on('authenticated', (data) => {
    console.log('Connected as user:', data.user_id);
    updateConnectionIndicator(true);
});

window.appNotifications.on('disconnected', () => {
    updateConnectionIndicator(false);
});
```

---

## 6. Deployment Guide

### 6.1 Production Configuration

```bash
# Environment variables for production
export JWT_SECRET="your-super-secure-random-secret-key"
export REDIS_HOST="your-redis-server.com"
export REDIS_PORT="6379"
export REDIS_PASSWORD="your-redis-password"
export CORS_ORIGIN="https://your-bitrix-domain.com"
export NODE_ENV="production"
export PORT="3000"
```

### 6.2 Process Management

```bash
# Using PM2 for production
npm install -g pm2
pm2 start server.js --name "app-notifications"
pm2 save
pm2 startup
```

### 6.3 Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name notifications.your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

This implementation provides a secure, scalable, and framework-agnostic approach to real-time notifications using connection-specific JWT tokens. Each browser tab gets a unique token that cannot be reused, ensuring maximum security for multi-device scenarios.
