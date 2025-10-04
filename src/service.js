import { WebSocketServer } from 'ws';
import logger from './logger.js';
import BiMap from 'bimap';

class Service
{
    constructor(port, manager) {
        this.port = port;
        this.manager = manager;
        this._handling = false;
        this.mappings = new Map(); // sessionId <-> ws
        this.wss = null;
    }

    init() {
        this.manager.addEventListener('message', this.handleEvent.bind(this));
    }

    start() {
        this.wss = new WebSocketServer({ port: this.port });
        this.wss.on('connection', (ws) => {
            ws.verified = false;
            ws.sessionId = null;

            ws.on('message', (message) => {
                let data;
                try {
                    data = JSON.parse(message);
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

            ws.on('close', () => {
                const sessionId = ws.sessionId;
                if (sessionId) {
                    this.mappings.delete(sessionId);
                }
            });

            ws.on('error', () => {
                const sessionId = ws.sessionId;
                if (sessionId) {
                    this.mappings.delete(sessionId);
                }
            });
        });
    }

    async handleEvent(id) {
        if (this._handling) return;
        this._handling = true;
        while (this.manager.eventqueue.length > 0) {
            const [event, data] = this.manager.eventqueue.shift();
            switch (event) {
                case 'message':
                    const dst = data.dst;
                    const msg = data.body;
                    const ws = this.mappings.get(dst);
                    if (ws) {
                        ws.send(JSON.stringify({ type: 'message', message: msg }));
                    } else {
                        logger.warn(`[WARN] No WebSocket found for session ID: ${dst}`);
                    }
                    break;
                default:
                    logger.warn(`[WARN] Unknown event type: ${event}`);
            }
        }
        this._handling = false;
    }

    handleMessage(ws, data) {
        if(!data.type) {
            ws.send(JSON.stringify({ type: 'error', message: 'Missing type field' }));
            return;
        }
        if(!ws.sessionId && data.type !== 'handshake') {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
        }
        switch (data.type) {
            case 'handshake':
                this.handleHandshake(ws, data);
                break;
            case 'message':
                logger.log(`Received message: ${data.body}`);
                this.manager.triggerRunnerEvent(ws.dst, 'message', {data: data.body, srcid: ws.sessionId}, 'scbackendbasic_message');
                break;
            default:
                ws.send(JSON.stringify({ type: 'error', message: 'Unknown type' }));
        }
    }

    handleHandshake(ws, data) {
        if (!data.dst || typeof data.dst !== 'string') {
            ws.send(JSON.stringify({ type: 'error', message: 'Missing dst field' }));
            return;
        }
        ws.dst = data.dst;
        if(!this.manager.runners[data.dst]) {
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown dst' }));
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
    }
}

export default Service;