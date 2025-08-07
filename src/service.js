const WebSocket = require('ws');

class Service
{
    constructor(manager,port = 8080) {
        this.manager = manager;
        this.manager.addEventListener('message', this.handleEvent.bind(this));
        this._handling = false;
        this.clients = new Set();
        this.wss = new WebSocket.Server({ port });

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
            });

            ws.on('error', () => {
                this.clients.delete(ws);
            });
        });
    }

    async handleEvent() {
        if (this._handling) return;
        this._handling = true;
        while (this.manager.eventqueue.length > 0) {
            const [event, data] = this.manager.eventqueue.shift();
        }
        this._handling = false;
    }

    handleMessage(ws, data) {
        switch (data.type) {
            case 'handshake':
                this.handleHandshake(ws, data);
                break;
            // 可以添加更多类型处理
            default:
                ws.send(JSON.stringify({ type: 'error', message: 'Unknown type' }));
        }
    }

    handleHandshake(ws, data) {
        // 这里可以做认证、分配ID等
        ws.send(JSON.stringify({ type: 'handshake', status: 'ok' }));
    }
}

export default Service;