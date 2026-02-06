# Redis channels naming proposal

This document proposes a naming convention for Redis channels for users to be able to receive only relevant notifications. The goal is to create a clear and consistent structure that makes it easy to identify the purpose of each channel.

## Current Implementation Analysis

Based on the existing codebase, we currently have these Redis channels:
- `user_notifications` - Send to all user's active connections
- `connection_notifications` - Send to specific browser tab/connection
- `broadcast_notifications` - Send to all connected users
- `socket.io-response#/#` - Legacy backwards compatibility

## Thinks to consider
- **User-specific channels**: Channels that are specific to individual users, allowing for targeted notifications. We should identify users by their unique IDs.
- **Global channels**: Channels that broadcast messages to all users, such as system-wide announcements or alerts.
- **Room-specific channels**: Channels that are specific to certain rooms or groups, allowing for notifications relevant to certain entities. I.e. we want to load a new element to UI once it is created in another instance of the app.
    - Abstract example. We have application entities: blog posts and comments. We want to notify users in a specific blog post room when a new comment is added to that and only that post. So we need some filtering mechanism.
    - More complex example. We want to update a filtered list of blog posts. So we need to notify users in a specific filtered list room when a new blog post is added that matches the filter criteria. The filter criteria can be based on various attributes such as category, tags, author, date range, etc. This requires a more sophisticated filtering mechanism to ensure that users only receive notifications for blog posts that are relevant to their specific filters.
    - We should think about this problem from two sides: how the backend should address notifications and how the frontend should subscribe to them.

## Proposed Channel Naming Convention

### 1. Hierarchical Structure
Use a dot-separated hierarchical naming convention that allows for pattern matching and logical grouping:

```
app.{scope}.{entity}.{action}.{filter?}
```

**Components:**
- `app` - Application namespace
- `scope` - Target scope (user, global, room, department, etc.)
- `entity` - Business entity (ticket, user, announcement, etc.)
- `action` - Action type (created, updated, deleted, assigned, etc.)
- `filter` - Optional filter criteria

### 2. Scope-Based Channels

#### User-Specific Channels
```
app.user.{user_id}.{entity}.{action}
app.user.{user_id}.ticket.created
app.user.{user_id}.ticket.assigned
app.user.{user_id}.message.received
app.user.{user_id}.session.warning
```

#### Connection-Specific Channels
```
app.connection.{connection_id}.{entity}.{action}
app.connection.{connection_id}.tab.focus
app.connection.{connection_id}.session.refresh
app.connection.{connection_id}.ui.update
```

#### Global/Broadcast Channels
```
app.global.{entity}.{action}
app.global.system.maintenance
app.global.announcement.published
app.global.server.shutdown
```

### 3. Entity-Based Room Channels

#### Ticket-Specific Channels
```
app.room.ticket.{ticket_id}.{action}
app.room.ticket.{ticket_id}.updated
app.room.ticket.{ticket_id}.comment.added
app.room.ticket.{ticket_id}.status.changed
app.room.ticket.{ticket_id}.assigned
```

#### Department-Specific Channels
```
app.room.department.{dept_id}.{entity}.{action}
app.room.department.{dept_id}.ticket.created
app.room.department.{dept_id}.user.joined
app.room.department.{dept_id}.announcement.published
```

#### Category-Based Channels
```
app.room.category.{category_id}.{entity}.{action}
app.room.category.hardware.ticket.created
app.room.category.software.ticket.escalated
```

### 4. Permission-Based Channels

#### Role-Specific Channels
```
app.role.{role_name}.{entity}.{action}
app.role.admin.system.alert
app.role.agent.ticket.assigned
app.role.supervisor.escalation.required
```

#### Priority-Based Channels
```
app.priority.{level}.{entity}.{action}
app.priority.high.ticket.created
app.priority.critical.system.alert
```

### 5. Advanced Filtering Channels

#### Multi-Criteria Filters
```
app.filter.{filter_hash}.{entity}.{action}
app.filter.a3b2c1.ticket.created  // Where filter_hash represents specific criteria
```

#### Tag-Based Channels
```
app.tag.{tag_name}.{entity}.{action}
app.tag.urgent.ticket.created
app.tag.security.incident.reported
```

## Implementation Strategy

### Phase 1: Backward Compatible Extension
1. Keep existing channels (`user_notifications`, `connection_notifications`, `broadcast_notifications`)
2. Add new hierarchical channels in parallel
3. Implement channel routing logic in socket.js

### Phase 2: Enhanced Subscription System
1. Implement pattern-based subscriptions using Redis PSUBSCRIBE
2. Add subscription management in ConnectionManager
3. Create subscription API for frontend

### Phase 3: Advanced Filtering
1. Implement filter hash system for complex criteria
2. Add subscription caching and optimization
3. Create UI for subscription management

## Frontend Subscription API Proposal

```javascript
// Subscribe to specific patterns
window.appNotifications.subscribe({
  patterns: [
    'app.user.{user_id}.ticket.*',
    'app.room.ticket.{ticket_id}.*',
    'app.global.system.*'
  ],
  filters: {
    priority: ['high', 'critical'],
    department: ['IT', 'HR'],
    tags: ['urgent']
  }
});

// Dynamic subscription updates
window.appNotifications.updateSubscriptions({
  add: ['app.room.ticket.12345.*'],
  remove: ['app.room.ticket.12344.*']
});
```

## Backend Publishing Examples

```php
// PHP Backend - Publish to hierarchical channels
NotificationSender::getInstance()->publishToChannel(
    'app.user.123.ticket.assigned',
    $notificationData
);

NotificationSender::getInstance()->publishToChannel(
    'app.room.ticket.456.comment.added',
    $commentData
);

// Multi-channel publishing for complex scenarios
NotificationSender::getInstance()->publishToMultipleChannels([
    'app.user.123.ticket.assigned',
    'app.room.department.IT.ticket.assigned',
    'app.priority.high.ticket.assigned'
], $notificationData);
```

## Benefits of This Approach

1. **Scalability**: Easy to add new entities and actions without breaking existing subscriptions
2. **Flexibility**: Support for complex filtering and multi-criteria subscriptions
3. **Performance**: Efficient pattern-based subscriptions reduce unnecessary message processing
4. **Maintainability**: Clear naming convention makes debugging and monitoring easier
5. **Backward Compatibility**: Existing channels remain functional during migration

## Migration Path

1. **Immediate**: Implement new channels alongside existing ones
2. **Short-term**: Update PHP backend to use both old and new channels
3. **Medium-term**: Update frontend to subscribe to new channel patterns
4. **Long-term**: Deprecate old channels after full migration and testing