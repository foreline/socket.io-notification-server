/**
 * Socket.IO Connection Test
 * 
 * This script demonstrates the proper way to connect to Socket.IO
 * and shows the difference between HTTP requests and Socket.IO connections.
 */

const http = require('http');

const serverUrl = 'localhost';
const serverPort = 3000;

/**
 * Test raw HTTP request to Socket.IO endpoint (WRONG WAY)
 * This will return Engine.IO framing data that looks strange
 */
function testRawHttpToSocketIO() {
    return new Promise((resolve) => {
        console.log('🌐 Testing RAW HTTP request to Socket.IO endpoint...');
        
        const options = {
            hostname: serverUrl,
            port: serverPort,
            path: '/socket.io/?EIO=4&transport=polling',
            method: 'GET',
            headers: {
                'Accept': 'text/plain'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('   📥 Raw response data:');
                console.log(`   "${data}"`);
                console.log('   ⚠️  This contains Engine.IO framing (numbers like 40, 42)');
                console.log('   ❌ Frontend cannot parse this directly!');
                resolve(data);
            });
        });

        req.on('error', (error) => {
            console.log(`   ❌ Failed: ${error.message}`);
            resolve(null);
        });

        req.end();
    });
}

/**
 * Test proper health endpoint (CORRECT WAY for HTTP)
 */
function testHealthEndpoint() {
    return new Promise((resolve) => {
        console.log('🏥 Testing HTTP health endpoint...');
        
        const options = {
            hostname: serverUrl,
            port: serverPort,
            path: '/health',
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('   📥 Response:');
                console.log(`   ${data}`);
                console.log('   ✅ This is proper JSON that frontend can parse');
                resolve(data);
            });
        });

        req.on('error', (error) => {
            console.log(`   ❌ Failed: ${error.message}`);
            resolve(null);
        });

        req.end();
    });
}

/**
 * Show the proper Socket.IO client connection code
 */
function showProperClientCode() {
    console.log('📝 PROPER Socket.IO Client Connection:');
    console.log('');
    console.log('   Frontend JavaScript:');
    console.log('   ```javascript');
    console.log('   // Install: npm install socket.io-client');
    console.log('   import { io } from "socket.io-client";');
    console.log('');
    console.log('   const socket = io("http://localhost:3000", {');
    console.log('     transports: ["websocket", "polling"],');
    console.log('     auth: {');
    console.log('       token: "your-jwt-token-here"');
    console.log('     }');
    console.log('   });');
    console.log('');
    console.log('   socket.on("connect", () => {');
    console.log('     console.log("Connected:", socket.id);');
    console.log('   });');
    console.log('');
    console.log('   socket.on("authentication_failed", (data) => {');
    console.log('     console.log("Auth failed:", data);');
    console.log('   });');
    console.log('   ```');
    console.log('');
    console.log('   ❌ DO NOT use fetch() or axios() for Socket.IO!');
    console.log('   ✅ USE the Socket.IO client library!');
}

/**
 * Run the demonstration
 */
async function runDemo() {
    console.log('🔍 Socket.IO Connection Issue Demonstration\n');
    
    // Test raw HTTP to Socket.IO (shows the problem)
    await testRawHttpToSocketIO();
    console.log('');
    
    // Test proper HTTP endpoint
    await testHealthEndpoint();
    console.log('');
    
    // Show proper client code
    showProperClientCode();
    
    console.log('\n🎯 SUMMARY:');
    console.log('   The strange response with numbers (40, 42) is Engine.IO framing.');
    console.log('   This happens when you make HTTP requests to Socket.IO endpoints.');
    console.log('   Use the Socket.IO client library instead!');
}

// Run demo if called directly
if (require.main === module) {
    runDemo().catch(console.error);
}

module.exports = { runDemo, testRawHttpToSocketIO, testHealthEndpoint };
