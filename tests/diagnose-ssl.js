/**
 * SSL Diagnostic Tool
 * 
 * This tool helps diagnose SSL-related issues by testing different connection scenarios.
 */

const http = require('http');
const https = require('https');

const serverUrl = 'localhost';
const serverPort = 3000;

/**
 * Test HTTP connection
 */
function testHttp() {
    return new Promise((resolve, reject) => {
        console.log('🌐 Testing HTTP connection...');
        
        const options = {
            hostname: serverUrl,
            port: serverPort,
            path: '/health',
            method: 'GET',
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    protocol: 'HTTP',
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data,
                    success: true
                });
            });
        });

        req.on('error', (error) => {
            resolve({
                protocol: 'HTTP',
                success: false,
                error: error.message,
                code: error.code
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                protocol: 'HTTP',
                success: false,
                error: 'Connection timeout'
            });
        });

        req.end();
    });
}

/**
 * Test HTTPS connection
 */
function testHttps() {
    return new Promise((resolve, reject) => {
        console.log('🔒 Testing HTTPS connection...');
        
        const options = {
            hostname: serverUrl,
            port: serverPort,
            path: '/health',
            method: 'GET',
            timeout: 5000,
            rejectUnauthorized: false // Allow self-signed certificates
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    protocol: 'HTTPS',
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data,
                    success: true
                });
            });
        });

        req.on('error', (error) => {
            resolve({
                protocol: 'HTTPS',
                success: false,
                error: error.message,
                code: error.code
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                protocol: 'HTTPS',
                success: false,
                error: 'Connection timeout'
            });
        });

        req.end();
    });
}

/**
 * Test Socket.IO endpoint
 */
function testSocketIO() {
    return new Promise((resolve) => {
        console.log('⚡ Testing Socket.IO endpoint...');
        
        const options = {
            hostname: serverUrl,
            port: serverPort,
            path: '/socket.io/',
            method: 'GET',
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    endpoint: 'Socket.IO',
                    statusCode: res.statusCode,
                    headers: res.headers,
                    success: res.statusCode < 400
                });
            });
        });

        req.on('error', (error) => {
            resolve({
                endpoint: 'Socket.IO',
                success: false,
                error: error.message
            });
        });

        req.end();
    });
}

/**
 * Run comprehensive diagnostics
 */
async function runDiagnostics() {
    console.log('🔍 Running SSL/Connection Diagnostics...\n');
    console.log(`Target: ${serverUrl}:${serverPort}\n`);

    // Test HTTP
    const httpResult = await testHttp();
    console.log('HTTP Result:');
    if (httpResult.success) {
        console.log(`   ✅ Status: ${httpResult.statusCode}`);
        console.log(`   📡 Server: ${httpResult.headers.server || 'Unknown'}`);
    } else {
        console.log(`   ❌ Failed: ${httpResult.error}`);
        if (httpResult.code) {
            console.log(`   🔍 Code: ${httpResult.code}`);
        }
    }
    console.log();

    // Test HTTPS
    const httpsResult = await testHttps();
    console.log('HTTPS Result:');
    if (httpsResult.success) {
        console.log(`   ✅ Status: ${httpsResult.statusCode}`);
        console.log(`   📡 Server: ${httpsResult.headers.server || 'Unknown'}`);
    } else {
        console.log(`   ❌ Failed: ${httpsResult.error}`);
        if (httpsResult.code) {
            console.log(`   🔍 Code: ${httpsResult.code}`);
        }
    }
    console.log();

    // Test Socket.IO
    const socketResult = await testSocketIO();
    console.log('Socket.IO Result:');
    if (socketResult.success) {
        console.log(`   ✅ Status: ${socketResult.statusCode}`);
    } else {
        console.log(`   ❌ Failed: ${socketResult.error || 'Unknown error'}`);
    }
    console.log();

    // Analysis
    console.log('🎯 Analysis:');
    
    if (httpResult.success && !httpsResult.success) {
        console.log('   ✅ Server is running HTTP only (correct for USE_HTTPS=false)');
        console.log('   💡 Use http://localhost:3000 (not https://)');
        
        if (httpsResult.error && httpsResult.error.includes('ECONNREFUSED')) {
            console.log('   ℹ️ HTTPS connection refused (expected)');
        } else if (httpsResult.error && httpsResult.error.includes('SSL_ERROR_RX_RECORD_TOO_LONG')) {
            console.log('   ⚠️ SSL_ERROR_RX_RECORD_TOO_LONG detected!');
            console.log('   🔍 This happens when trying HTTPS on an HTTP server');
        }
    } else if (!httpResult.success && httpsResult.success) {
        console.log('   🔒 Server is running HTTPS only');
        console.log('   💡 Use https://localhost:3000');
    } else if (httpResult.success && httpsResult.success) {
        console.log('   ⚠️ Server responds to both HTTP and HTTPS (unusual)');
    } else {
        console.log('   ❌ Server is not responding on either protocol');
        console.log('   💡 Make sure the server is running: npm start');
    }

    console.log('\n🚀 Quick Fix:');
    if (httpResult.success) {
        console.log('   ✅ Server is running correctly');
        console.log('   🌐 Access via: http://localhost:3000');
        console.log('   ⚠️ DO NOT use https:// - it will cause SSL errors');
    } else {
        console.log('   📋 Start the server first: npm start');
    }
}

// Run diagnostics if called directly
if (require.main === module) {
    runDiagnostics().catch(console.error);
}

module.exports = { runDiagnostics, testHttp, testHttps, testSocketIO };
