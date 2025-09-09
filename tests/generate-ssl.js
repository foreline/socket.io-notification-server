#!/usr/bin/env node

/**
 * SSL Certificate Generator for Development
 * 
 * This script generates self-signed SSL certificates for local development.
 * DO NOT use these certificates in production!
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sslDir = path.join(__dirname, 'config', 'ssl');
const certPath = path.join(sslDir, 'certificate.crt');
const keyPath = path.join(sslDir, 'private.key');

/**
 * Check if OpenSSL is available
 */
function checkOpenSSL() {
    try {
        execSync('openssl version', { stdio: 'ignore' });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Generate self-signed SSL certificate
 */
function generateCertificate() {
    console.log('🔐 Generating self-signed SSL certificate for development...\n');
    
    // Check if OpenSSL is available
    if (!checkOpenSSL()) {
        console.error('❌ OpenSSL is not installed or not in PATH');
        console.log('\n💡 To install OpenSSL:');
        console.log('   Windows: Download from https://slproweb.com/products/Win32OpenSSL.html');
        console.log('   macOS: brew install openssl');
        console.log('   Linux: sudo apt-get install openssl (Ubuntu/Debian)');
        process.exit(1);
    }

    // Create SSL directory if it doesn't exist
    if (!fs.existsSync(sslDir)) {
        fs.mkdirSync(sslDir, { recursive: true });
        console.log(`📁 Created SSL directory: ${sslDir}`);
    }

    // Check if certificates already exist
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        console.log('⚠️ SSL certificates already exist:');
        console.log(`   Certificate: ${certPath}`);
        console.log(`   Private Key: ${keyPath}`);
        console.log('\n🔄 To regenerate, delete existing files and run this script again.');
        return;
    }

    try {
        // Generate private key
        console.log('🔑 Generating private key...');
        execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'inherit' });

        // Generate certificate
        console.log('📜 Generating certificate...');
        const opensslConfig = `
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = Development
L = Local
O = ServiceDesk Development
CN = localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = 127.0.0.1
IP.1 = 127.0.0.1
IP.2 = ::1
        `;

        const configPath = path.join(sslDir, 'openssl.conf');
        fs.writeFileSync(configPath, opensslConfig.trim());

        execSync(`openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -config "${configPath}"`, 
                 { stdio: 'inherit' });

        // Clean up config file
        fs.unlinkSync(configPath);

        console.log('\n✅ SSL certificates generated successfully!');
        console.log(`   Certificate: ${certPath}`);
        console.log(`   Private Key: ${keyPath}`);
        console.log('   Valid for: 365 days');
        
        console.log('\n⚠️ SECURITY WARNING:');
        console.log('   These are self-signed certificates for DEVELOPMENT ONLY!');
        console.log('   Browsers will show security warnings.');
        console.log('   DO NOT use in production!');
        
        console.log('\n🔧 To enable HTTPS:');
        console.log('   1. Set USE_HTTPS=true in config/.env');
        console.log('   2. Update SSL paths if needed:');
        console.log(`      SSL_CERT_PATH=${certPath}`);
        console.log(`      SSL_KEY_PATH=${keyPath}`);

    } catch (error) {
        console.error('❌ Certificate generation failed:', error.message);
        process.exit(1);
    }
}

/**
 * Show SSL configuration status
 */
function showStatus() {
    console.log('🔍 SSL Configuration Status:\n');
    
    console.log(`SSL Directory: ${sslDir}`);
    console.log(`Certificate: ${fs.existsSync(certPath) ? '✅ Found' : '❌ Missing'} - ${certPath}`);
    console.log(`Private Key: ${fs.existsSync(keyPath) ? '✅ Found' : '❌ Missing'} - ${keyPath}`);
    
    // Check config
    try {
        const config = require('../src/utils/config.js');
        console.log(`\nCurrent Configuration:`);
        console.log(`USE_HTTPS: ${config.server.useHttps}`);
        console.log(`SSL_CERT_PATH: ${config.ssl.certPath}`);
        console.log(`SSL_KEY_PATH: ${config.ssl.keyPath}`);
    } catch (error) {
        console.log('\n❌ Could not load configuration:', error.message);
    }
}

// Main execution
const command = process.argv[2];

switch (command) {
    case 'generate':
    case 'gen':
        generateCertificate();
        break;
    case 'status':
        showStatus();
        break;
    case 'help':
    case '--help':
    case '-h':
        console.log('SSL Certificate Manager for ServiceDesk Socket.IO Server\n');
        console.log('Usage:');
        console.log('  node generate-ssl.js generate  - Generate self-signed certificates');
        console.log('  node generate-ssl.js status    - Show SSL configuration status');
        console.log('  node generate-ssl.js help      - Show this help message');
        break;
    default:
        console.log('🔐 SSL Certificate Manager\n');
        showStatus();
        console.log('\n💡 Commands:');
        console.log('  node generate-ssl.js generate  - Generate certificates');
        console.log('  node generate-ssl.js status    - Show status');
        console.log('  node generate-ssl.js help      - Show help');
        break;
}
