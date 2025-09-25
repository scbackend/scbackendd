import { WebSocketServer } from 'ws';
import logger from './logger.js';

class Service
{
    constructor(port, manager) {
        this.port = port;
        this.manager = manager;
        this._handling = false;
        this.clients = new Set();
        this.verifiedClients = {};
        this.wss = null;
    }

    init() {
        this.manager.addEventListener('message', this.handleEvent.bind(this));
    }

    start() {
        this.wss = new WebSocketServer({ port: this.port });
        this.wss.on('connection', (ws) => {
            this.clients.add(ws);

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
                for (const i of Object.values(this.verifiedClients)) {
                    i.delete(ws);
                }
            });

            ws.on('error', () => {
                this.clients.delete(ws);
                for (const i of Object.values(this.verifiedClients)) {
                    i.delete(ws);
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
        if(!this.verifiedClients[data.dst]) {
            if(!this.manager.runners[data.dst]) {
                ws.send(JSON.stringify({ type: 'error', message: 'Unknown dst' }));
                return;
            }
            this.verifiedClients[data.dst] = new Set();
        }
        if(this.verifiedClients[data.dst].has(ws)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Already verified for this dst' }));
            return;
        }
        this.verifiedClients[data.dst].add(ws);
        ws.send(JSON.stringify({ type: 'handshake', status: 'ok' }));
    }
}

export default Service;