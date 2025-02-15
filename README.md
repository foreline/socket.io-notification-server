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
