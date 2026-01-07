
import { useState, useEffect, useRef, useCallback } from 'react';
import { IStokUserIdentity } from '../features/istok/services/istokIdentity';
import { debugService } from '../services/debugService';

export const useGlobalPeer = (identity: IStokUserIdentity | null) => {
    const peerRef = useRef<any>(null);
    const [incomingConnection, setIncomingConnection] = useState<any>(null);
    const [isPeerReady, setIsPeerReady] = useState(false);
    const [peerId, setPeerId] = useState<string | null>(null);
    const reconnectInterval = useRef<any>(null);
    const heartbeatInterval = useRef<any>(null);

    // DESTROY & CLEANUP
    const destroyPeer = () => {
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        setIsPeerReady(false);
        setPeerId(null);
        if (reconnectInterval.current) clearInterval(reconnectInterval.current);
        if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    };

    const initGlobalPeer = useCallback(async () => {
        if (!identity || !identity.istokId) return;
        
        // Prevent double init if already active and healthy
        if (peerRef.current && !peerRef.current.destroyed && !peerRef.current.disconnected) {
            return; 
        }

        try {
            console.log('[GLOBAL] INITIALIZING HYDRA ENGINE...');
            const { Peer } = await import('peerjs');
            
            let iceServers = [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ];

            const meteredKey = process.env.VITE_METERED_API_KEY;
            const meteredDomain = process.env.VITE_METERED_DOMAIN || 'istoic.metered.live';

            if (meteredKey) {
                try {
                    const response = await fetch(`https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredKey}`);
                    const ice = await response.json();
                    if (Array.isArray(ice)) {
                        iceServers = [...ice, ...iceServers];
                        console.log("[GLOBAL] TURN RELAY: ACTIVATED");
                    }
                } catch (e) {
                    console.warn("[GLOBAL] TURN FALLBACK: STANDARD");
                }
            }

            // Create Peer with explicit keep-alive config
            const peer = new Peer(identity.istokId, {
                debug: 0,
                config: { 
                    iceServers: iceServers,
                    iceTransportPolicy: 'all',
                    iceCandidatePoolSize: 10
                },
                pingInterval: 5000, // Aggressive ping
            } as any);

            // --- EVENT HANDLERS ---

            peer.on('open', (id) => {
                console.log('[GLOBAL] HYDRA ONLINE:', id);
                setIsPeerReady(true);
                setPeerId(id);
                
                // Start Heartbeat to keep socket alive
                if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
                heartbeatInterval.current = setInterval(() => {
                    if (peer && !peer.destroyed && !peer.disconnected) {
                        peer.socket?.send({ type: 'HEARTBEAT' });
                    }
                }, 10000);
            });

            peer.on('connection', (conn) => {
                debugService.log('INFO', 'GLOBAL', 'INCOMING', `Connection from ${conn.peer}`);
                conn.on('data', (data: any) => {
                    if (data.type === 'SYS' || data.type === 'HANDSHAKE_SYN') {
                        setIncomingConnection({ conn, firstData: data });
                    }
                });
                // Ensure connection stays open
                conn.on('open', () => {
                   // Keep-alive for data channel
                });
            });

            // CRITICAL: Handle Disconnection (Socket closed, but ID preserved)
            peer.on('disconnected', () => {
                console.warn('[GLOBAL] SIGNAL LOST. ATTEMPTING RECONNECT...');
                setIsPeerReady(false);
                // Attempt rapid reconnect
                peer.reconnect();
            });

            // CRITICAL: Handle Close (Fatal, ID lost)
            peer.on('close', () => {
                console.error('[GLOBAL] PEER DESTROYED. REBOOTING...');
                setIsPeerReady(false);
                setPeerId(null);
                // Full restart after delay
                setTimeout(() => initGlobalPeer(), 2000);
            });

            peer.on('error', (err) => {
                console.error("[GLOBAL] ERROR:", err);
                if (err.type === 'peer-unavailable' || err.type === 'network' || err.type === 'server-error') {
                     // Silent retry logic
                     if (!peer.disconnected && !peer.destroyed) {
                         // Do nothing, transient
                     } else {
                         setTimeout(() => initGlobalPeer(), 3000);
                     }
                }
                // Fatal ID error
                if (err.type === 'unavailable-id') {
                    console.warn("[GLOBAL] ID TAKEN. ATTEMPTING FORCE REBIND...");
                    // Optional: Append random suffix or notify user
                }
            });

            peerRef.current = peer;

        } catch (e) {
            console.error("[GLOBAL] FATAL INIT FAIL", e);
            setTimeout(initGlobalPeer, 5000); // Retry loop
        }
    }, [identity]);

    // Initial Setup
    useEffect(() => {
        if (identity?.istokId) {
            initGlobalPeer();
        }
        return () => destroyPeer();
    }, [identity, initGlobalPeer]);

    // Network Recovery Listener
    useEffect(() => {
        const handleOnline = () => {
            console.log("[GLOBAL] NETWORK RESTORED. REBOOTING HYDRA...");
            if (peerRef.current?.disconnected) {
                peerRef.current.reconnect();
            } else if (!peerRef.current || peerRef.current.destroyed) {
                initGlobalPeer();
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [initGlobalPeer]);

    return {
        peer: peerRef.current,
        isPeerReady,
        peerId, // Expose ID specifically for UI check
        incomingConnection,
        clearIncoming: () => setIncomingConnection(null),
        forceReconnect: () => {
             console.log("[GLOBAL] MANUAL RECONNECT TRIGGERED");
             if (peerRef.current) {
                 if (peerRef.current.disconnected) peerRef.current.reconnect();
                 else destroyPeer(); initGlobalPeer();
             } else {
                 initGlobalPeer();
             }
        }
    };
};
