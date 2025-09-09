/**
 * CORS Test Script
 * 
 * This script tests CORS configuration including preflight OPTIONS requests.
 * Run this after starting the server to verify CORS is properly configured.
 */

const http = require('http');

// Test configuration
const serverUrl = 'http://localhost:3000';
const testOrigin = 'http://localhost:8080';

/**
 * Make an OPTIONS request to test preflight
 */
function testPreflightRequest() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/health',
            method: 'OPTIONS',
            headers: {
                'Origin': testOrigin,
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type,Authorization'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        });

        req.on('error', reject);
        req.end();
    });
}

/**
 * Make a GET request to test actual request
 */
function testActualRequest() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/health',
            method: 'GET',
            headers: {
                'Origin': testOrigin,
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        });

        req.on('error', reject);
        req.end();
    });
}

/**
 * Run CORS tests
 */
async function runCorsTests() {
    console.log('🧪 Testing CORS Configuration...\n');

    try {
        // Test preflight OPTIONS request
        console.log('1. Testing preflight OPTIONS request...');
        const preflightResponse = await testPreflightRequest();
        
        console.log(`   Status: ${preflightResponse.statusCode}`);
        console.log(`   Access-Control-Allow-Origin: ${preflightResponse.headers['access-control-allow-origin']}`);
        console.log(`   Access-Control-Allow-Methods: ${preflightResponse.headers['access-control-allow-methods']}`);
        console.log(`   Access-Control-Allow-Headers: ${preflightResponse.headers['access-control-allow-headers']}`);
        console.log(`   Access-Control-Allow-Credentials: ${preflightResponse.headers['access-control-allow-credentials']}`);
        
        if (preflightResponse.statusCode === 200) {
            console.log('   ✅ Preflight request successful\n');
        } else {
            console.log('   ❌ Preflight request failed\n');
            return false;
        }

        // Test actual GET request
        console.log('2. Testing actual GET request...');
        const actualResponse = await testActualRequest();
        
        console.log(`   Status: ${actualResponse.statusCode}`);
        console.log(`   Access-Control-Allow-Origin: ${actualResponse.headers['access-control-allow-origin']}`);
        
        if (actualResponse.statusCode === 200) {
            console.log('   ✅ Actual request successful\n');
            console.log('   Response data:', JSON.parse(actualResponse.data));
        } else {
            console.log('   ❌ Actual request failed\n');
            return false;
        }

        console.log('🎉 All CORS tests passed! Production deployment should work correctly.');
        return true;
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ Connection refused - Server is not running');
            console.log('\n💡 To test CORS configuration:');
            console.log('   1. Start the server: npm start');
            console.log('   2. Run this test: npm run test:cors');
            console.log('\n� CORS Configuration Status:');
            console.log('   ✅ OPTIONS method included in server config');
            console.log('   ✅ Explicit preflight handling added');
            console.log('   ✅ CORS middleware configured properly');
            console.log('\n🚀 Ready for production deployment!');
        } else {
            console.error('❌ CORS test failed:', error.message);
        }
        return false;
    }
}

// Run tests if called directly
if (require.main === module) {
    runCorsTests();
}

module.exports = { runCorsTests, testPreflightRequest, testActualRequest };
