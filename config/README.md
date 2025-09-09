# Configuration Files

This directory contains the environment configuration files for the ServiceDesk Socket.IO Server.

## Files

- `.env.example` - Template with all available configuration options and documentation
- `.env` - Your actual environment configuration (copy from .env.example)

## Setup

1. Copy the example file:
   ```bash
   cp config/.env.example config/.env
   ```

2. Edit `config/.env` with your specific settings:
   ```bash
   # Required settings
   JWT_SECRET=your-super-secure-random-secret-key
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   ```

3. The configuration automatically supports legacy environment variable names:
   - `SOCKET_IO_CORS_ORIGIN` → `CORS_ORIGIN`
   - `SSL_CERTIFICATE` → `SSL_CERT_PATH`
   - `SSL_CERTIFICATE_KEY` → `SSL_KEY_PATH`

## Important Notes

- **Never commit the `.env` file** - it contains sensitive information
- **Always change the JWT_SECRET** in production environments
- **Review all security settings** before deploying to production

## Environment Variables Reference

See `.env.example` for complete documentation of all available configuration options.
