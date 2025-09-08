# Bitrix Session Management Implementation Guide

## Overview

This document outlines the implementation of a universal session management system for Bitrix CMS that supports multi-device notifications through the Socket.IO server. The system automatically detects Bitrix session storage configuration and provides appropriate handlers for all storage types.

## Architecture

### Problem Statement
- Users can have multiple active sessions (different devices/browsers)
- Bitrix can store sessions in different ways (files, database, Redis, custom)
- Need to find all active sessions for a user to send notifications to all devices
- Must be storage-agnostic and work across different Bitrix configurations

### Solution Overview
A **Strategy Pattern** implementation with:
1. **Auto-detection** of Bitrix session storage configuration
2. **Specialized handlers** for each storage type (file, database, Redis, fallback)
3. **Unified interface** for session management
4. **Fallback mechanism** for unknown/custom configurations

## Core Components

### 1. Session Storage Detection (`BitrixSessionStorageDetector`)

**Purpose**: Automatically detect how Bitrix stores sessions

**Detection Methods**:
- `Bitrix\Main\Config\Configuration` class (modern Bitrix)
- Parse `/bitrix/.settings.php` directly
- Check PHP session configuration
- Fallback to file-based default

**Detection Code**:
```php
class BitrixSessionStorageDetector {
    public static function detectStorageType() {
        // Try Bitrix Configuration class
        if (class_exists('Bitrix\Main\Config\Configuration')) {
            $config = \Bitrix\Main\Config\Configuration::getInstance();
            $sessionConfig = $config->get('session');
            if ($sessionConfig) {
                return self::parseSessionConfig($sessionConfig);
            }
        }
        
        // Parse .settings.php
        $settingsPath = $_SERVER['DOCUMENT_ROOT'] . '/bitrix/.settings.php';
        if (file_exists($settingsPath)) {
            $settings = include $settingsPath;
            if (isset($settings['session'])) {
                return self::parseSessionConfig($settings['session']);
            }
        }
        
        // Check PHP configuration
        return self::detectPhpSessionConfig();
    }
}
```

### 2. Session Handler Interface (`SessionHandlerInterface`)

**Purpose**: Unified interface for all session storage types

**Methods**:
- `getAllUserSessions($userId)` - Get all active session IDs for user
- `registerUserSession($userId, $sessionId)` - Register session (for fallback)
- `removeUserSession($sessionId, $userId)` - Remove session
- `isSessionValid($sessionId)` - Check if session is still active
- `cleanup()` - Remove expired sessions

### 3. Storage-Specific Handlers

#### FileSessionHandler
**For**: Default PHP file-based sessions

**Approach**: 
- Scan session files in session save path
- Parse PHP session data format
- Extract user ID from `SESS_AUTH` data
- Validate session expiration

**Key Methods**:
```php
public function getAllUserSessions($userId) {
    $activeSessions = [];
    $sessionFiles = glob($this->sessionPath . '/sess_*');
    
    foreach ($sessionFiles as $sessionFile) {
        $sessionId = str_replace('sess_', '', basename($sessionFile));
        if ($this->isSessionForUser($sessionFile, $userId)) {
            $activeSessions[] = $sessionId;
        }
    }
    return $activeSessions;
}
```

#### DatabaseSessionHandler
**For**: Database-stored sessions

**Approach**:
- Query session table (usually `b_user_session`)
- Parse session data from database records
- Filter by user ID and expiration

**Key Methods**:
```php
public function getAllUserSessions($userId) {
    global $DB;
    $maxLifetime = ini_get('session.gc_maxlifetime');
    $minTimestamp = time() - $maxLifetime;
    
    $query = "SELECT session_id, session_data FROM {$this->tableName} WHERE timestamp > {$minTimestamp}";
    // Parse and filter by user ID
}
```

#### RedisSessionHandler
**For**: Redis-based sessions

**Approach**:
- Scan Redis keys matching session pattern
- Parse session data from Redis values
- Use Redis TTL for expiration

**Key Methods**:
```php
public function getAllUserSessions($userId) {
    $pattern = $this->prefix . '*';
    $keys = $this->redis->keys($pattern);
    
    foreach ($keys as $key) {
        $sessionData = $this->redis->get($key);
        // Parse and filter by user ID
    }
}
```

#### FallbackSessionHandler
**For**: Custom/unknown session storage or registry overlay

**Approach**:
- Maintain own session registry in Redis
- Use Bitrix API for session validation
- Requires session registration hooks

**Key Methods**:
```php
public function registerUserSession($userId, $sessionId = null) {
    $this->redis->sadd("bitrix_sessions:user:$userId", $sessionId);
    $this->redis->setex("bitrix_sessions:session:$sessionId", $this->sessionTimeout, $userId);
}

public function isSessionValid($sessionId) {
    // Use Bitrix API to validate session
    session_id($sessionId);
    session_start();
    global $USER;
    return $USER && $USER->IsAuthorized();
}
```

### 4. Universal Session Manager Factory (`UniversalSessionManager`)

**Purpose**: Single entry point that auto-detects and provides appropriate handler

**Usage**:
```php
$sessionManager = UniversalSessionManager::getInstance();
$sessions = $sessionManager->getAllUserSessions($userId);
```

## Implementation Steps

### Phase 1: Core Classes
1. Implement `BitrixSessionStorageDetector`
2. Create `SessionHandlerInterface`
3. Build `UniversalSessionManager` factory

### Phase 2: Storage Handlers
1. Implement `FileSessionHandler`
2. Implement `DatabaseSessionHandler` 
3. Implement `RedisSessionHandler`
4. Implement `FallbackSessionHandler`

### Phase 3: Integration
1. Create notification function using session manager
2. Add session registration hooks (for fallback)
3. Test across different Bitrix configurations

## Usage Examples

### Basic Notification Sending
```php
function sendNotificationToUser($userId, $notification) {
    $sessionManager = UniversalSessionManager::getInstance();
    $sessionIds = $sessionManager->getAllUserSessions($userId);
    
    if (empty($sessionIds)) {
        error_log("No active sessions found for user $userId");
        return false;
    }
    
    $redis = new Redis();
    $redis->connect('127.0.0.1', 6379);
    
    foreach ($sessionIds as $sessionId) {
        $redis->publish("notification:$sessionId", json_encode($notification));
    }
    
    return true;
}
```

### Session Registration (for fallback handler)
```php
// Add to Bitrix init.php or component prolog
$sessionManager = UniversalSessionManager::getInstance();

if (defined('BX_SECURITY_SESSION_VIRTUAL')) {
    global $USER;
    if ($USER && $USER->IsAuthorized()) {
        $sessionManager->registerUserSession($USER->GetID());
    }
}
```

### HTTP Endpoint for Node.js Integration
```php
// /bitrix/tools/session_manager.php
require_once($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/prolog_before.php");

$sessionManager = UniversalSessionManager::getInstance();
$input = json_decode(file_get_contents('php://input'), true);

switch ($input['action']) {
    case 'get_user_sessions':
        $result = [
            'sessions' => $sessionManager->getAllUserSessions($input['user_id']),
            'handler' => $sessionManager->getHandlerType()
        ];
        break;
    case 'validate_session':
        $result = [
            'valid' => $sessionManager->isSessionValid($input['session_id'])
        ];
        break;
}

header('Content-Type: application/json');
echo json_encode($result);
```

## Node.js Integration

The PHP session manager integrates with the Node.js Socket.IO server through Redis pub/sub:

1. **Client connects** with Bitrix session ID
2. **Node.js validates** session via HTTP call to Bitrix
3. **PHP backend** uses session manager to get all user sessions
4. **Notifications published** to Redis channels for each session: `notification:{session_id}`
5. **Node.js delivers** notifications to connected clients

## Benefits

- ✅ **Universal Compatibility**: Works with any Bitrix session storage
- ✅ **Performance Optimized**: Uses most efficient method for each storage type
- ✅ **Auto-Detection**: No manual configuration required
- ✅ **Multi-Device Support**: Notifications reach all user devices
- ✅ **Fallback Ready**: Always has a working solution
- ✅ **Maintainable**: Clean separation of concerns
- ✅ **Future Proof**: Easy to extend for new storage types

## Testing Strategy

1. **File Sessions**: Test with default Bitrix installation
2. **Database Sessions**: Test with Bitrix configured for DB sessions
3. **Redis Sessions**: Test with Redis session handler
4. **Custom Sessions**: Test fallback with unknown configurations
5. **Multi-Device**: Verify notifications reach multiple browser sessions
6. **Performance**: Benchmark session lookup times for large user bases

## Files to Create

1. `BitrixSessionStorageDetector.php` - Detection logic
2. `SessionHandlerInterface.php` - Interface definition
3. `FileSessionHandler.php` - File-based implementation
4. `DatabaseSessionHandler.php` - Database implementation
5. `RedisSessionHandler.php` - Redis implementation
6. `FallbackSessionHandler.php` - Fallback implementation
7. `UniversalSessionManager.php` - Factory and main API
8. `session_manager.php` - HTTP endpoint for Node.js
9. `notification_sender.php` - Helper functions

## Security Considerations

- Session data parsing must handle malformed data gracefully
- File access permissions for session files
- Database query injection prevention
- Redis connection security
- Session validation through Bitrix API maintains security model
- No session data exposure in logs or errors

## Performance Notes

- File scanning can be slow with many sessions (use caching)
- Database queries should be indexed on timestamp
- Redis operations are generally fastest
- Consider implementing session count limits per user
- Cleanup expired sessions regularly to maintain performance
