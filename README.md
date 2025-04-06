# Socket.io notifications backend

## Requirements

* nodejs
* redis
* npm
  * express
  * pm2
  * socket.io
  * socket.io-redis 

```bash
apt install redis
# or
yum install redis
```

## Usage

Install packages:
```bash
npm install
```

Start application:
```bash
pm2 start ecosystem.config.js
```

Stop application:
```bash
pm2 stop ecosystem.config.js
```

Client example:
```javascript
const client = new SocketClient('http://localhost:3000', window.eventEmitter, token);

/**
 *
 */
class SocketClient {
    
    constructor(url = 'http://localhost:3000', eventEmitter, token) {
        this.socket = null;
        this.url = url;
        this.token = token;
        this.initialize(eventEmitter);
    }
    
    initialize(eventEmitter)
    {
        // Initialize Socket.IO connection with all transports
        this.socket = io(this.url, {
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            auth: {
                token: this.token
            }
        });
        
        // Bind event handlers
        this.bindEventHandlers(eventEmitter);
    }
    
    bindEventHandlers(eventEmitter)
    {
        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        // Connection errors events
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
        });
        
        // Disconnection events
        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected:', reason);
        });
        
        // Custom events from server
        this.socket.on('clientCount', (count) => {
            console.log(`Active clients: ${count}`);
        });
        
        // Message events
        this.socket.on('message', (data) => {
            console.log(`Received message from ${data.sender}: ${data.message}`);
        })
    
        // Broadcast events
        this.socket.on('broadcast', (data) => {
            console.log(`Received broadcast message`);
            
            const message = JSON.parse(data.message);
            
            const event = message.event;
            const entity = message.entity;
            
            eventEmitter.emit(event, entity);
        });
    
        // Handle acknowledgments
        this.socket.on('acknowledge', (messageId) => {
            console.log(`Message acknowledged: ${messageId}`);
        });
    }
    
    sendMessage(message)
    {
        if ( !this.socket.connected ) {
            console.error('Cannot send message - not connected');
            return;
        }
        
        const messageId = Date.now().toString();
        this.socket.emit('message', {
            id: messageId,
            content: message
        }, (ack) => {
            if (ack?.error) {
                console.error('Message delivery failed:', ack.error);
            }
        });
    }
    
    disconnect()
    {
        if ( !this.socket ) {
            return;
        }
        
        this.socket.disconnect();
    }
}
```