import { WebSocketServer } from 'ws';
import logger from './logger.js';
import BiMap from 'bimap';

class Service
{
    constructor(port, manager) {
        this.port = port;
        this.manager = manager;
        this._handling = false;
        this.clients = new Map();
        this.mappings = new BiMap(); // sessionId <-> ws
        this.wss = null;
    }

    init() {
        this.manager.addEventListener('message', this.handleEvent.bind(this));
    }

    start() {
        this.wss = new WebSocketServer({ port: this.port });
        this.wss.on('connection', (ws) => {
            this.clients.set(ws, { verified: false, sessionId: null });
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
                this.clients.delete(ws);
                const sessionId = ws.sessionId;
                if (sessionId) {
                    this.mappings.removeKey(sessionId);
                }
            });

            ws.on('error', () => {
                this.clients.delete(ws);
                const sessionId = ws.sessionId;
                if (sessionId) {
                    this.mappings.removeKey(sessionId);
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
                    const msg = data.message;
                    const ws = this.mappings.key(dst) || this.mappings.val(dst);
                    if (ws && this.clients.has(ws) && this.clients.get(ws).verified) {
                        ws.send(JSON.stringify({ type: 'message', message: msg }));
                    }
                    break;
                default:
                    logger.warn(`[WARN] Unknown event type: ${event}`);
            }
        }
        this._handling = false;
    }

    handleMessage(ws, data) {
        switch (data.type) {
            case 'handshake':
                this.handleHandshake(ws, data);
                break;
            case 'message':
                logger.log('Received message:', data);
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
        if(!this.manager.runners[data.dst]) {
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown dst' }));
            return;
        }
        // 握手完成后分配唯一sessionId
        if (!ws.sessionId) {
            let sessionId;
            do {
                sessionId = Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
            } while (this.mappings.val({verified: true, sessionId}));
            ws.sessionId = sessionId;
            this.clients.get(ws).sessionId = sessionId;
            this.mappings.set(ws, {verified: true, sessionId});//标记为已验证
            this.manager.runners[data.dst].trigger('handshake', sessionId, 'newconnection');
        }
        const sessionId = ws.sessionId;
        ws.send(JSON.stringify({ type: 'handshake', status: 'ok', sessionId }));
    }
}

export default Service;