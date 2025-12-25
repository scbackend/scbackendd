import { WebSocketServer } from 'ws';
import logger from './logger.js';

class Service {
    constructor(port, manager) {
        this.port = port;
        this.manager = manager;
        this._handling = false;
        this.mappings = new Map(); // sessionId <-> ws
        this.wss = null;
        this.maxMessageSize = 1024 * 1024; // 1MB 最大消息大小
        this.maxConnections = 1000; // 最大连接数
        this.connectionCount = 0;
    }

    init() {
        this.manager.addEventListener('message', this.handleEvent.bind(this));
    }

    start() {
        this.wss = new WebSocketServer({ 
            port: this.port,
            maxPayload: this.maxMessageSize,
            clientTracking: true
        });

        this.wss.on('connection', (ws, req) => {
            // 连接数限制
            if (this.connectionCount >= this.maxConnections) {
                ws.close(1013, 'Server too busy'); // Try again later
                return;
            }
            this.connectionCount++;

            ws.verified = false;
            ws.sessionId = null;
            ws.ip = req.socket.remoteAddress;

            logger.info(`New WebSocket connection from ${ws.ip}`, 'Service');

            ws.on('message', (message) => {
                // 消息大小检查
                if (message.length > this.maxMessageSize) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Message too large' }));
                    ws.close(1009, 'Message too large');
                    return;
                }

                let data;
                try {
                    data = JSON.parse(message.toString());
                } catch (e) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
                    return;
                }
                
                if (!data.type) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Missing type field' }));
                    return;
                }
                
                this.handleMessage(ws, data);
            });

            ws.on('close', (code, reason) => {
                this.connectionCount--;
                const dst = ws.dst;
                if (dst && this.manager.runners[dst]) {
                    this.manager.triggerRunnerEvent(dst, 'disconnect', { sessionid: ws.sessionId }, 'scbackendbasic_disconnect');
                }
                const sessionId = ws.sessionId;
                if (sessionId) {
                    this.mappings.delete(sessionId);
                }
                logger.info(`WebSocket connection closed: ${ws.ip}, code: ${code}, reason: ${reason}`, 'Service');
            });

            ws.on('error', (error) => {
                logger.error(`WebSocket error from ${ws.ip}: ${error.message}`, 'Service');
                const dst = ws.dst;
                if (dst && this.manager.runners[dst]) {
                    this.manager.triggerRunnerEvent(dst, 'disconnect', { sessionid: ws.sessionId }, 'scbackendbasic_disconnect');
                }
                const sessionId = ws.sessionId;
                if (sessionId) {
                    this.mappings.delete(sessionId);
                }
            });

            // 心跳检测
            ws.isAlive = true;
            ws.on('pong', () => {
                ws.isAlive = true;
            });
        });

        // 心跳检测间隔
        const interval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (!ws.isAlive) {
                    logger.warn(`Terminating stale connection from ${ws.ip}`, 'Service');
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);

        this.wss.on('close', () => {
            clearInterval(interval);
        });

        logger.info(`WebSocket service started on port ${this.port}`, 'Service');
    }

    async handleEvent(id) {
        if (this._handling) return;
        this._handling = true;
        try {
            while (this.manager.eventqueue.length > 0) {
                const [event, data] = this.manager.eventqueue.shift();
                switch (event) {
                    case 'message':
                        const dst = data.dst;
                        const msg = data.body;
                        const ws = this.mappings.get(dst);
                        if (ws) {
                            try {
                                ws.send(JSON.stringify({ type: 'message', message: msg }));
                            } catch (error) {
                                logger.error(`Failed to send message to session ${dst}: ${error.message}`, 'Service');
                            }
                        }
                        break;
                    case 'kick':
                        const kickDst = data.dst;
                        const reason = data.reason || 'Kicked by server';
                        const kickWs = this.mappings.get(kickDst);
                        if (kickWs) {
                            try {
                                kickWs.send(JSON.stringify({ type: 'kick', reason }));
                                kickWs.close(1000, reason);
                                this.mappings.delete(kickDst);
                                logger.info(`Kicked session ${kickDst}: ${reason}`, 'Service');
                            } catch (error) {
                                logger.error(`Failed to kick session ${kickDst}: ${error.message}`, 'Service');
                            }
                        }
                        break;
                    default:
                        logger.warn(`Unknown event type: ${event}`, 'Service');
                }
            }
        } catch (error) {
            logger.error(`Error handling events: ${error.message}`, 'Service');
        } finally {
            this._handling = false;
        }
    }

    handleMessage(ws, data) {
        if (!data.type) {
            ws.send(JSON.stringify({ type: 'error', message: 'Missing type field' }));
            return;
        }
        
        if (!ws.sessionId && data.type !== 'handshake') {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
        }
        
        // 验证消息结构
        if (!this.validateMessage(data)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message structure' }));
            return;
        }
        
        switch (data.type) {
            case 'handshake':
                this.handleHandshake(ws, data);
                break;
            case 'message':
                if (!data.body || typeof data.body !== 'string') {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message body' }));
                    return;
                }
                logger.info(`Received message from ${ws.ip}: ${data.body.substring(0, 100)}`, 'Service');
                this.manager.triggerRunnerEvent(ws.dst, 'message', {data: data.body, srcid: ws.sessionId}, 'scbackendbasic_message');
                break;
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
            default:
                ws.send(JSON.stringify({ type: 'error', message: 'Unknown type' }));
        }
    }

    handleHandshake(ws, data) {
        if (!data.dst || typeof data.dst !== 'string') {
            ws.send(JSON.stringify({ type: 'error', message: 'Missing dst field' }));
            ws.close(1008, 'Invalid handshake');
            return;
        }
        
        // 验证目标runner ID
        if (!/^[\w-]+$/.test(data.dst)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid dst format' }));
            ws.close(1008, 'Invalid handshake');
            return;
        }
        
        ws.dst = data.dst;
        if (!this.manager.runners[data.dst]) {
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown dst' }));
            ws.close(1008, 'Unknown runner');
            return;
        }
        
        // 握手完成后分配唯一sessionId
        if (!ws.sessionId) {
            let sessionId;
            do {
                sessionId = Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
            } while (this.mappings.has(sessionId));
            ws.sessionId = sessionId;
            this.mappings.set(sessionId, ws);
            this.manager.triggerRunnerEvent(data.dst, 'handshake', {sessionid: sessionId}, 'scbackendbasic_newconnect');
        }
        
        const sessionId = ws.sessionId;
        ws.send(JSON.stringify({ type: 'handshake', status: 'ok', sessionId }));
        logger.info(`Handshake successful for ${ws.ip} to runner ${data.dst}, session: ${sessionId}`, 'Service');
    }

    validateMessage(data) {
        if (typeof data !== 'object' || data === null) {
            return false;
        }
        
        if (typeof data.type !== 'string') {
            return false;
        }
        
        // 根据消息类型验证额外字段
        switch (data.type) {
            case 'handshake':
                return typeof data.dst === 'string';
            case 'message':
                return typeof data.body === 'string';
            case 'ping':
                return true;
            default:
                return false;
        }
    }

    stop() {
        if (this.wss) {
            // 关闭所有连接
            this.wss.clients.forEach((ws) => {
                ws.close(1001, 'Server shutting down');
            });
            this.wss.close();
            logger.info('WebSocket service stopped', 'Service');
        }
    }
}

export default Service;