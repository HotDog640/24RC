type Handlers = {
    onMessage: (ev: MessageEvent) => void;
    onOpen?: () => void;
    onClose?: (ev: CloseEvent) => void;
    onError?: () => void;
};

type Options = {
    heartbeatInterval?: number;
    heartbeatTimeout?: number;
    reconnectBase?: number;
    reconnectMax?: number;
};

export default function createWebSocketManager(url: string, handlers: Handlers, options?: Options) {
    const HEARTBEAT_INTERVAL = options?.heartbeatInterval ?? 15000;
    const HEARTBEAT_TIMEOUT = options?.heartbeatTimeout ?? 30000;
    const RECONNECT_BASE = options?.reconnectBase ?? 2000;
    const RECONNECT_MAX = options?.reconnectMax ?? 30000;

    let ws: WebSocket | null = null;
    let lastMessageAt = Date.now();
    let heartbeatTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let reconnectDelay = RECONNECT_BASE;
    let openConfirmTimer: number | null = null;

    function scheduleReconnect() {
        if (reconnectTimer) return;
        const wait = Math.min(reconnectDelay, RECONNECT_MAX);
        reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;
            connect();
            reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX);
        }, wait) as unknown as number;
    }

    function startHeartbeat() {
        if (heartbeatTimer) return;
        heartbeatTimer = window.setInterval(() => {
            if (!ws) return;
            if (Date.now() - lastMessageAt > HEARTBEAT_TIMEOUT) {
                try { ws.close(); } catch (e) { }
                return;
            }
            if (ws.readyState === WebSocket.OPEN) {
                try { ws.send(JSON.stringify({ t: 'PING' })); } catch (e) { }
            }
            if (ws.readyState === WebSocket.CLOSED) {
                scheduleReconnect();
            }
        }, HEARTBEAT_INTERVAL) as unknown as number;
    }

    function stopHeartbeat() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer as number);
            heartbeatTimer = null;
        }
    }

    function cleanupSocket() {
        if (!ws) return;
        try { ws.onopen = null; ws.onclose = null; ws.onerror = null; ws.onmessage = null; } catch (e) { }
        try { ws.close(); } catch (e) { }
        ws = null;
    }

    function connect() {
        cleanupSocket();
        ws = new WebSocket(url);

        ws.onopen = () => {
            reconnectDelay = RECONNECT_BASE;
            lastMessageAt = Date.now();
            if (openConfirmTimer) clearTimeout(openConfirmTimer);
            openConfirmTimer = window.setTimeout(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    handlers.onOpen && handlers.onOpen();
                }
                openConfirmTimer = null;
            }, 500) as unknown as number;
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        };

        ws.onclose = (ev: CloseEvent) => {
            if (openConfirmTimer) {
                clearTimeout(openConfirmTimer);
                openConfirmTimer = null;
            }
            handlers.onClose && handlers.onClose(ev);
            if (ev && ev.code === 1008) {
                if (reconnectTimer) return;
                reconnectTimer = window.setTimeout(() => {
                    reconnectTimer = null;
                    connect();
                }, 10000) as unknown as number;
            } else {
                scheduleReconnect();
            }
        };

        ws.onerror = () => {
            handlers.onError && handlers.onError();
            try { ws?.close(); } catch (e) { }
        };

        ws.onmessage = (ev) => {
            lastMessageAt = Date.now();
            handlers.onMessage(ev);
        };
    }

    function start() {
        connect();
        startHeartbeat();
    }

    function stop() {
        stopHeartbeat();
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        cleanupSocket();
    }

    function isConnected() {
        return !!ws && ws.readyState === WebSocket.OPEN;
    }

    return { start, stop, isConnected };
}
