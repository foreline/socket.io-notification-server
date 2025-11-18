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
servicedesk.{scope}.{entity}.{action}.{filter?}
```

**Components:**
- `servicedesk` - Application namespace
- `scope` - Target scope (user, global, room, department, etc.)
- `entity` - Business entity (ticket, user, announcement, etc.)
- `action` - Action type (created, updated, deleted, assigned, etc.)
- `filter` - Optional filter criteria

### 2. Scope-Based Channels

#### User-Specific Channels
```
servicedesk.user.{user_id}.{entity}.{action}
servicedesk.user.{user_id}.ticket.created
servicedesk.user.{user_id}.ticket.assigned
servicedesk.user.{user_id}.message.received
servicedesk.user.{user_id}.session.warning
```

#### Connection-Specific Channels
```
servicedesk.connection.{connection_id}.{entity}.{action}
servicedesk.connection.{connection_id}.tab.focus
servicedesk.connection.{connection_id}.session.refresh
servicedesk.connection.{connection_id}.ui.update
```

#### Global/Broadcast Channels
```
servicedesk.global.{entity}.{action}
servicedesk.global.system.maintenance
servicedesk.global.announcement.published
servicedesk.global.server.shutdown
```

### 3. Entity-Based Room Channels

#### Ticket-Specific Channels
```
servicedesk.room.ticket.{ticket_id}.{action}
servicedesk.room.ticket.{ticket_id}.updated
servicedesk.room.ticket.{ticket_id}.comment.added
servicedesk.room.ticket.{ticket_id}.status.changed
servicedesk.room.ticket.{ticket_id}.assigned
```

#### Department-Specific Channels
```
servicedesk.room.department.{dept_id}.{entity}.{action}
servicedesk.room.department.{dept_id}.ticket.created
servicedesk.room.department.{dept_id}.user.joined
servicedesk.room.department.{dept_id}.announcement.published
```

#### Category-Based Channels
```
servicedesk.room.category.{category_id}.{entity}.{action}
servicedesk.room.category.hardware.ticket.created
servicedesk.room.category.software.ticket.escalated
```

### 4. Permission-Based Channels

#### Role-Specific Channels
```
servicedesk.role.{role_name}.{entity}.{action}
servicedesk.role.admin.system.alert
servicedesk.role.agent.ticket.assigned
servicedesk.role.supervisor.escalation.required
```

#### Priority-Based Channels
```
servicedesk.priority.{level}.{entity}.{action}
servicedesk.priority.high.ticket.created
servicedesk.priority.critical.system.alert
```

### 5. Advanced Filtering Channels

#### Multi-Criteria Filters
```
servicedesk.filter.{filter_hash}.{entity}.{action}
servicedesk.filter.a3b2c1.ticket.created  // Where filter_hash represents specific criteria
```

#### Tag-Based Channels
```
servicedesk.tag.{tag_name}.{entity}.{action}
servicedesk.tag.urgent.ticket.created
servicedesk.tag.security.incident.reported
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
window.serviceDeskNotifications.subscribe({
  patterns: [
    'servicedesk.user.{user_id}.ticket.*',
    'servicedesk.room.ticket.{ticket_id}.*',
    'servicedesk.global.system.*'
  ],
  filters: {
    priority: ['high', 'critical'],
    department: ['IT', 'HR'],
    tags: ['urgent']
  }
});

// Dynamic subscription updates
window.serviceDeskNotifications.updateSubscriptions({
  add: ['servicedesk.room.ticket.12345.*'],
  remove: ['servicedesk.room.ticket.12344.*']
});
```

## Backend Publishing Examples

```php
// PHP Backend - Publish to hierarchical channels
NotificationSender::getInstance()->publishToChannel(
    'servicedesk.user.123.ticket.assigned',
    $notificationData
);

NotificationSender::getInstance()->publishToChannel(
    'servicedesk.room.ticket.456.comment.added',
    $commentData
);

// Multi-channel publishing for complex scenarios
NotificationSender::getInstance()->publishToMultipleChannels([
    'servicedesk.user.123.ticket.assigned',
    'servicedesk.room.department.IT.ticket.assigned',
    'servicedesk.priority.high.ticket.assigned'
], $notificationData);
```

## Benefits of This Approach

1. **Scalability**: Easy to add new entities and actions without breaking existing subscriptions
2. **Flexibility**: Support for complex filtering and multi-criteria subscriptions
3. **Performance**: Efficient pattern-based subscriptions reduce unnecessary message processing
4. **Maintainability**: Clear naming convention makes debugging and monitoring easier
5. **Backward Compatibility**: Existing channels remain functional during migration
6. **Future-Proof**: Structure supports future ServiceDesk features and entities

## Migration Path

1. **Immediate**: Implement new channels alongside existing ones
2. **Short-term**: Update PHP backend to use both old and new channels
3. **Medium-term**: Update frontend to subscribe to new channel patterns
4. **Long-term**: Deprecate old channels after full migration and testing