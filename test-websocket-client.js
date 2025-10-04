/**
 * WebSocket 客户端测试脚本
 * 用于测试 scbackendd 的 WebSocket 通信功能
 */

import WebSocket from 'ws';

class TestClient {
    constructor(url, runnerId) {
        this.url = url;
        this.runnerId = runnerId;
        this.ws = null;
        this.sessionId = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            console.log(`[INFO] Connecting to ${this.url}...`);
            this.ws = new WebSocket(this.url);

            this.ws.on('open', () => {
                console.log('[INFO] WebSocket connection established');
                this.setupHandlers();
                resolve();
            });

            this.ws.on('error', (error) => {
                console.error('[ERROR] WebSocket error:', error);
                reject(error);
            });
        });
    }

    setupHandlers() {
        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log('[RECEIVED]', message);

                switch(message.type) {
                    case 'handshake':
                        if (message.status === 'ok') {
                            this.sessionId = message.sessionId;
                            console.log(`[INFO] Handshake successful, sessionId: ${this.sessionId}`);
                        }
                        break;
                    case 'message':
                        console.log(`[MESSAGE] Received from runner: ${message.message}`);
                        break;
                    case 'error':
                        console.error(`[ERROR] Server error: ${message.message}`);
                        break;
                }
            } catch (e) {
                console.error('[ERROR] Failed to parse message:', e);
            }
        });

        this.ws.on('close', () => {
            console.log('[INFO] WebSocket connection closed');
        });
    }

    handshake() {
        return new Promise((resolve) => {
            console.log(`[INFO] Sending handshake to runner: ${this.runnerId}`);
            this.ws.send(JSON.stringify({
                type: 'handshake',
                dst: this.runnerId
            }));

            // 等待握手响应
            setTimeout(() => resolve(this.sessionId), 1000);
        });
    }

    sendMessage(message) {
        if (!this.sessionId) {
            console.error('[ERROR] Not authenticated. Please handshake first.');
            return;
        }

        console.log(`[SEND] Sending message: ${message}`);
        this.ws.send(JSON.stringify({
            type: 'message',
            body: message
        }));
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// 测试函数
async function runTest() {
    // 配置
    const WEBSOCKET_URL = 'ws://localhost:3031';
    const RUNNER_ID = 'test-runner'; // 替换为你的 runner ID

    console.log('='.repeat(50));
    console.log('WebSocket Client Test');
    console.log('='.repeat(50));

    const client = new TestClient(WEBSOCKET_URL, RUNNER_ID);

    try {
        // 1. 连接
        await client.connect();

        // 2. 握手
        await client.handshake();

        if (!client.sessionId) {
            throw new Error('Handshake failed');
        }

        // 3. 发送测试消息
        console.log('\n--- Sending test messages ---');
        client.sendMessage('Hello from test client!');

        await new Promise(resolve => setTimeout(resolve, 1000));
        client.sendMessage('Second message');

        await new Promise(resolve => setTimeout(resolve, 1000));
        client.sendMessage('Third message');

        // 4. 等待响应
        console.log('\n--- Waiting for responses (10 seconds) ---');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // 5. 关闭连接
        console.log('\n--- Closing connection ---');
        client.close();

        console.log('\n[INFO] Test completed successfully');

    } catch (error) {
        console.error('[ERROR] Test failed:', error);
        client.close();
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    runTest().catch(console.error);
}

export default TestClient;
