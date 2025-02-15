/*
 *
 */

require('dotenv').config({
    //path: './../../config/.env'
    path: '/config/.env'
});

const config = {
    server: {
        port: parseInt(process.env.PORT),
        nodeEnv: process.env.NODE_ENV,
        sslCertificate: process.env.SSL_CERTIFICATE,
        ssLCertificateKey: process.env.SSL_CERTIFICATE_KEY,
    },
    redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT)
    },
    socketIo: {
        corsOrigin: process.env.SOCKET_IO_CORS_ORIGIN,
        corsMethods: ['GET', 'POST'],
        pingTimeout: 60000,
        pingInterval: 25000
    }
};

module.exports = config;