/**
 * Socket.IO Client Debugging Tool
 * 
 * This script helps identify where JSON parsing errors are occurring
 * in your Socket.IO client implementation.
 */

const http = require('http');

/**
 * Test different types of requests to identify JSON parsing issues
 */
class SocketIODebugger {
    constructor(serverUrl = 'http://localhost:3001') {
        this.serverUrl = serverUrl;
    }

    /**
     * Test raw HTTP requests to Socket.IO endpoints (these will cause JSON errors)
     */
    async testRawRequests() {
        console.log('\n🔍 Testing Raw HTTP Requests (these cause JSON parsing errors):');
        console.log('=' .repeat(70));

        const tests = [
            '/socket.io/?EIO=4&transport=polling',
            '/socket.io/?EIO=4&transport=polling&t=' + Date.now(),
            '/health',
            '/stats'
        ];

        for (const path of tests) {
            try {
                console.log(`\n📍 Testing: ${this.serverUrl}${path}`);
                
                const response = await this.makeHttpRequest(path);
                console.log(`   Status: ${response.status}`);
                console.log(`   Content-Type: ${response.contentType}`);
                console.log(`   Response: "${response.data}"`);
                
                // Try to parse as JSON (this will fail for Engine.IO endpoints)
                try {
                    const parsed = JSON.parse(response.data);
                    console.log('   ✅ JSON Parse: SUCCESS');
                    console.log('   📄 Parsed Data:', JSON.stringify(parsed, null, 2));
                } catch (jsonError) {
                    console.log('   ❌ JSON Parse: FAILED');
                    console.log(`   🚫 Error: ${jsonError.message}`);
                    console.log('   💡 This is normal for Engine.IO endpoints!');
                }
                
            } catch (error) {
                console.log(`   ❌ Request failed: ${error.message}`);
            }
        }
    }

    /**
     * Make an HTTP request and return response details
     */
    makeHttpRequest(path) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.serverUrl);
            
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'SocketIO-Debugger/1.0'
                }
            };

            const req = http.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        contentType: res.headers['content-type'] || 'unknown',
                        data: data
                    });
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    /**
     * Show common JSON parsing error patterns
     */
    showCommonErrors() {
        console.log('\n🚨 Common JSON Parsing Error Patterns:');
        console.log('=' .repeat(70));

        const errorExamples = [
            {
                response: '40',
                description: 'Engine.IO handshake frame',
                error: 'JSON.parse: unexpected character at line 1 column 2'
            },
            {
                response: '42["event",{"data":"value"}]',
                description: 'Engine.IO message frame with JSON payload',
                error: 'JSON.parse: unexpected character at line 1 column 2'
            },
            {
                response: '6',
                description: 'Engine.IO close frame',
                error: 'JSON.parse: unexpected end of data'
            },
            {
                response: 'ok',
                description: 'Plain text response',
                error: 'JSON.parse: unexpected character at line 1 column 2'
            }
        ];

        errorExamples.forEach((example, index) => {
            console.log(`\n${index + 1}. Response: "${example.response}"`);
            console.log(`   Type: ${example.description}`);
            console.log(`   JSON Error: ${example.error}`);
            
            try {
                JSON.parse(example.response);
            } catch (error) {
                console.log(`   ❌ Actual Error: ${error.message}`);
            }
        });
    }

    /**
     * Show the correct way to handle different response types
     */
    showCorrectHandling() {
        console.log('\n✅ Correct Response Handling:');
        console.log('=' .repeat(70));

        console.log(`
1. 🔌 Socket.IO Events (use socket.on()):
   socket.on('user_message', (data) => {
       // data is already parsed by Socket.IO
       console.log(data.message);  // ✅ No JSON.parse needed
   });

2. 📡 HTTP API Endpoints (check content-type):
   fetch('/health')
       .then(response => {
           if (response.headers.get('content-type').includes('application/json')) {
               return response.json();  // ✅ Use .json() for JSON responses
           } else {
               return response.text();  // ✅ Use .text() for plain text
           }
       });

3. 🚫 DON'T Access Engine.IO Endpoints Directly:
   // ❌ Wrong - returns protocol frames
   fetch('/socket.io/?EIO=4&transport=polling')
   
   // ✅ Correct - use Socket.IO client
   const socket = io('http://localhost:3001');

4. 🔍 Response Type Detection:
   async function handleResponse(response) {
       const contentType = response.headers.get('content-type');
       
       if (contentType && contentType.includes('application/json')) {
           return await response.json();  // ✅ JSON response
       } else {
           return await response.text();   // ✅ Text response
       }
   }
        `);
    }

    /**
     * Run all debugging tests
     */
    async runFullDiagnosis() {
        console.log('🔧 Socket.IO Client JSON Parsing Debugger');
        console.log('=' .repeat(70));
        console.log('This tool helps identify where JSON parsing errors occur');
        
        await this.testRawRequests();
        this.showCommonErrors();
        this.showCorrectHandling();
        
        console.log('\n🎯 Summary:');
        console.log('- Engine.IO endpoints return protocol frames (40, 42, 6) - NOT JSON');
        console.log('- Use Socket.IO client library for real-time communication');
        console.log('- Use HTTP endpoints (/health, /stats) for JSON data');
        console.log('- Check Content-Type header before parsing JSON');
        console.log('- Socket.IO events are automatically parsed');
    }
}

/**
 * CLI Usage
 */
if (require.main === module) {
    const jsonDebugger = new SocketIODebugger();
    
    // Run diagnosis
    jsonDebugger.runFullDiagnosis().catch(error => {
        console.error('❌ Debugger failed:', error);
    });
}

module.exports = SocketIODebugger;
