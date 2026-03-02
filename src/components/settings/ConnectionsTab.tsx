import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    Loader2,
    Plus,
    Trash2,
    RefreshCw,
    QrCode,
    Unplug,
    Smartphone,
    CheckCircle2,
    XCircle,
    Wifi,
    WifiOff,
    X,
    Cable,
    AlertTriangle,
} from 'lucide-react';

// ─── Types ───
interface WhatsAppConnection {
    id: number;
    user_id: string;
    instance: string;
    instance_id: string | null;
    token: string | null;
    status: string;
    phone_number: string | null;
    profile_name: string | null;
    profile_pic_url: string | null;
    qrcode: string | null;
    plan_limit: number;
    created_at: string;
    updated_at: string;
}

type ConnectionAction = 'create' | 'connect' | 'disconnect' | 'delete' | 'status' | 'list';

// ─── Status Config ───
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; icon: React.ReactNode }> = {
    connected: {
        label: 'Conectado',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50 border-emerald-200',
        dot: 'bg-emerald-500',
        icon: <Wifi size={14} />,
    },
    connecting: {
        label: 'Conectando...',
        color: 'text-amber-700',
        bg: 'bg-amber-50 border-amber-200',
        dot: 'bg-amber-500 animate-pulse',
        icon: <RefreshCw size={14} className="animate-spin" />,
    },
    disconnected: {
        label: 'Desconectado',
        color: 'text-slate-500',
        bg: 'bg-slate-50 border-slate-200',
        dot: 'bg-slate-400',
        icon: <WifiOff size={14} />,
    },
    pending: {
        label: 'Pendente',
        color: 'text-slate-400',
        bg: 'bg-slate-50 border-slate-200',
        dot: 'bg-slate-300',
        icon: <Loader2 size={14} className="animate-spin" />,
    },
};

const getStatusConfig = (status: string) => STATUS_CONFIG[status] || STATUS_CONFIG['disconnected'];

// ─── Main Component ───
const ConnectionsTab: React.FC = () => {
    const { user } = useAuth();

    // State
    const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
    const [planLimit, setPlanLimit] = useState(1);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null); // tracks which action is running
    const [error, setError] = useState<string | null>(null);

    // QR Code Modal
    const [qrModal, setQrModal] = useState<{
        open: boolean;
        qrcode: string | null;
        paircode: string | null;
        connectionId: number | null;
    }>({ open: false, qrcode: null, paircode: null, connectionId: null });

    // QR Modal connected state
    const [qrModalConnected, setQrModalConnected] = useState<{
        connected: boolean;
        profileName: string | null;
        phoneNumber: string | null;
        profilePicUrl: string | null;
    }>({ connected: false, profileName: null, phoneNumber: null, profilePicUrl: null });

    // Polling refs
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const qrPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ─── API Helper ───
    const callApi = useCallback(async (action: ConnectionAction, extra: Record<string, unknown> = {}) => {
        console.log(`[ConnectionsTab] callApi: ${action}`, extra);

        // Buscar sessão atual para obter o JWT
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            throw new Error('Sessão expirada. Faça login novamente.');
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-uazapi`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': anonKey,
            },
            body: JSON.stringify({ action, ...extra }),
        });

        console.log(`[ConnectionsTab] HTTP status: ${res.status}`);

        // Ler body como texto primeiro para evitar erros de parse
        const text = await res.text();
        console.log(`[ConnectionsTab] Response body:`, text.substring(0, 500));

        let data: any;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(`Resposta inválida do servidor (HTTP ${res.status}): ${text.substring(0, 200)}`);
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        return data;
    }, []);

    // ─── Fetch Connections ───
    const fetchConnections = useCallback(async () => {
        if (!user) return;
        try {
            const data = await callApi('list');
            setConnections(data.connections || []);
            setPlanLimit(data.plan_limit || 1);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching connections:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user, callApi]);

    // ─── Poll Status ───
    const pollStatus = useCallback(async () => {
        if (!user || connections.length === 0) return;

        for (const conn of connections) {
            try {
                const data = await callApi('status', { connection_id: conn.id });
                setConnections(prev =>
                    prev.map(c =>
                        c.id === conn.id
                            ? {
                                ...c,
                                status: data.live_status || c.status,
                                profile_name: data.connection?.profile_name || c.profile_name,
                                profile_pic_url: data.connection?.profile_pic_url || c.profile_pic_url,
                                phone_number: data.connection?.phone_number || c.phone_number,
                            }
                            : c
                    )
                );
            } catch (err) {
                console.warn('Polling status error for connection', conn.id, err);
            }
        }
    }, [user, connections, callApi]);

    // Initial load
    useEffect(() => {
        fetchConnections();
    }, [fetchConnections]);

    // Polling every 6 seconds
    useEffect(() => {
        if (connections.length > 0) {
            pollingRef.current = setInterval(pollStatus, 6000);
        }
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [connections.length, pollStatus]);

    // ─── QR Modal Polling (detect connection success) ───
    useEffect(() => {
        if (!qrModal.open || !qrModal.connectionId || qrModalConnected.connected) {
            return;
        }

        const pollQrStatus = async () => {
            try {
                const data = await callApi('status', { connection_id: qrModal.connectionId });
                const liveStatus = data.live_status || '';
                if (liveStatus === 'connected' || liveStatus === 'open') {
                    setQrModalConnected({
                        connected: true,
                        profileName: data.connection?.profile_name || null,
                        phoneNumber: data.connection?.phone_number || null,
                        profilePicUrl: data.connection?.profile_pic_url || null,
                    });
                    // Update the connections list too
                    setConnections(prev =>
                        prev.map(c =>
                            c.id === qrModal.connectionId
                                ? {
                                    ...c,
                                    status: 'connected',
                                    profile_name: data.connection?.profile_name || c.profile_name,
                                    profile_pic_url: data.connection?.profile_pic_url || c.profile_pic_url,
                                    phone_number: data.connection?.phone_number || c.phone_number,
                                }
                                : c
                        )
                    );
                }
            } catch (err) {
                console.warn('QR modal polling error:', err);
            }
        };

        // Poll immediately, then every 4 seconds
        pollQrStatus();
        qrPollingRef.current = setInterval(pollQrStatus, 4000);

        return () => {
            if (qrPollingRef.current) {
                clearInterval(qrPollingRef.current);
                qrPollingRef.current = null;
            }
        };
    }, [qrModal.open, qrModal.connectionId, qrModalConnected.connected, callApi]);

    // ─── Close QR Modal Helper ───
    const closeQrModal = () => {
        setQrModal({ open: false, qrcode: null, paircode: null, connectionId: null });
        setQrModalConnected({ connected: false, profileName: null, phoneNumber: null, profilePicUrl: null });
        fetchConnections(); // refresh list after closing
    };

    // ─── Actions ───
    const handleCreate = async () => {
        if (actionLoading) return;
        setActionLoading('create');
        setError(null);
        try {
            await callApi('create');
            await fetchConnections();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleConnect = async (connectionId: number) => {
        if (actionLoading) return;
        setActionLoading(`connect-${connectionId}`);
        setError(null);
        setQrModalConnected({ connected: false, profileName: null, phoneNumber: null, profilePicUrl: null });
        try {
            const data = await callApi('connect', { connection_id: connectionId });
            setQrModal({
                open: true,
                qrcode: data.qrcode || null,
                paircode: data.paircode || null,
                connectionId,
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDisconnect = async (connectionId: number) => {
        if (actionLoading) return;
        if (!confirm('Tem certeza que deseja desconectar esta instância? Será necessário escanear um novo QR Code para reconectar.')) return;
        setActionLoading(`disconnect-${connectionId}`);
        setError(null);
        try {
            await callApi('disconnect', { connection_id: connectionId });
            setConnections(prev =>
                prev.map(c => (c.id === connectionId ? { ...c, status: 'disconnected', qrcode: null } : c))
            );
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (connectionId: number) => {
        if (actionLoading) return;
        if (!confirm('Tem certeza que deseja EXCLUIR esta conexão? Esta ação é irreversível e a instância será removida permanentemente.')) return;
        setActionLoading(`delete-${connectionId}`);
        setError(null);
        try {
            await callApi('delete', { connection_id: connectionId });
            setConnections(prev => prev.filter(c => c.id !== connectionId));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRefreshStatus = async (connectionId: number) => {
        if (actionLoading) return;
        setActionLoading(`status-${connectionId}`);
        try {
            const data = await callApi('status', { connection_id: connectionId });
            setConnections(prev =>
                prev.map(c =>
                    c.id === connectionId
                        ? {
                            ...c,
                            status: data.live_status || c.status,
                            profile_name: data.connection?.profile_name || c.profile_name,
                            profile_pic_url: data.connection?.profile_pic_url || c.profile_pic_url,
                            phone_number: data.connection?.phone_number || c.phone_number,
                        }
                        : c
                )
            );
        } catch (err: any) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // ─── Loading State ───
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-slate-300" size={32} />
            </div>
        );
    }

    // ─── Render ───
    const canCreateMore = connections.length < planLimit;

    return (
        <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
            {/* Header */}
            <div className="border-b border-slate-100 pb-4 mb-6 flex justify-between items-end">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Conexões</h2>
                    <p className="text-sm text-slate-500">
                        Gerencie as suas conexões de WhatsApp.
                        <span className="ml-2 text-xs text-slate-400">
                            ({connections.length}/{planLimit} instância{planLimit > 1 ? 's' : ''})
                        </span>
                    </p>
                </div>
                {canCreateMore && (
                    <button
                        onClick={handleCreate}
                        disabled={actionLoading === 'create'}
                        className="flex items-center space-x-2 px-4 py-2 bg-[#ffd700] text-slate-900 rounded-xl text-xs font-bold shadow-lg shadow-[#ffd700]/30 hover:bg-[#f8ab15] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {actionLoading === 'create' ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Plus size={16} />
                        )}
                        <span>Nova Conexão</span>
                    </button>
                )}
            </div>

            {/* Error Alert */}
            {error && (
                <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
                    <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-bold text-red-800">Erro</p>
                        <p className="text-xs text-red-600 mt-0.5">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="text-red-300 hover:text-red-500">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Empty State */}
            {connections.length === 0 && (
                <div className="text-center py-16 space-y-4">
                    <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto">
                        <Cable size={36} className="text-slate-300" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-700">Nenhuma conexão ativa</h3>
                        <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                            Conecte sua primeira instância WhatsApp para começar a gerenciar suas mensagens e disparos.
                        </p>
                    </div>
                </div>
            )}

            {/* Connection Cards */}
            <div className="space-y-4">
                {connections.map((conn) => {
                    const statusCfg = getStatusConfig(conn.status);
                    const isConnected = conn.status === 'connected';

                    return (
                        <div
                            key={conn.id}
                            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                        >
                            {/* Status accent bar */}
                            <div className={`h-1 w-full ${isConnected ? 'bg-emerald-500' : conn.status === 'connecting' ? 'bg-amber-400' : 'bg-slate-200'
                                }`} />

                            <div className="p-5">
                                <div className="flex items-center justify-between gap-4">
                                    {/* Left: Instance Info */}
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isConnected ? 'bg-emerald-50' : 'bg-slate-50'
                                            }`}>
                                            {conn.profile_pic_url ? (
                                                <img
                                                    src={conn.profile_pic_url}
                                                    alt={conn.profile_name || 'WhatsApp'}
                                                    className="w-12 h-12 rounded-2xl object-cover"
                                                />
                                            ) : (
                                                <Smartphone size={22} className={isConnected ? 'text-emerald-500' : 'text-slate-400'} />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold text-slate-900 truncate">
                                                    {conn.profile_name || conn.instance}
                                                </h3>
                                                {/* Status Badge */}
                                                <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${statusCfg.bg} ${statusCfg.color}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                                    {statusCfg.label}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                                {conn.phone_number && (
                                                    <span className="text-xs text-slate-500">{conn.phone_number}</span>
                                                )}
                                                <span className="text-[10px] text-slate-300">
                                                    ID: {conn.instance.substring(0, 20)}…
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Action Buttons */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* Refresh Status */}
                                        <button
                                            onClick={() => handleRefreshStatus(conn.id)}
                                            disabled={!!actionLoading}
                                            title="Atualizar Status"
                                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-30"
                                        >
                                            {actionLoading === `status-${conn.id}` ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <RefreshCw size={16} />
                                            )}
                                        </button>

                                        {/* Connect / QR Code */}
                                        {!isConnected && (
                                            <button
                                                onClick={() => handleConnect(conn.id)}
                                                disabled={!!actionLoading}
                                                title="Gerar QR Code"
                                                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-colors disabled:opacity-30"
                                            >
                                                {actionLoading === `connect-${conn.id}` ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <QrCode size={14} />
                                                )}
                                                <span>Conectar</span>
                                            </button>
                                        )}

                                        {/* Disconnect */}
                                        {isConnected && (
                                            <button
                                                onClick={() => handleDisconnect(conn.id)}
                                                disabled={!!actionLoading}
                                                title="Desconectar"
                                                className="flex items-center gap-1.5 px-3 py-2 text-amber-600 hover:bg-amber-50 rounded-xl text-xs font-bold transition-colors disabled:opacity-30"
                                            >
                                                {actionLoading === `disconnect-${conn.id}` ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Unplug size={14} />
                                                )}
                                                <span>Desconectar</span>
                                            </button>
                                        )}

                                        {/* Delete */}
                                        <button
                                            onClick={() => handleDelete(conn.id)}
                                            disabled={!!actionLoading}
                                            title="Excluir Conexão"
                                            className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-30"
                                        >
                                            {actionLoading === `delete-${conn.id}` ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <Trash2 size={16} />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* QR Code Modal */}
            {qrModal.open && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 text-lg">
                                {qrModalConnected.connected ? 'WhatsApp Conectado!' : 'Conectar WhatsApp'}
                            </h3>
                            <button
                                onClick={closeQrModal}
                                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6">
                            {/* ✅ SUCCESS STATE */}
                            {qrModalConnected.connected ? (
                                <div className="text-center space-y-5 py-4">
                                    <div className="relative inline-block">
                                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto animate-in zoom-in-50 duration-500">
                                            <CheckCircle2 size={40} className="text-emerald-500" />
                                        </div>
                                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center animate-in zoom-in-0 duration-700 delay-300">
                                            <Wifi size={12} className="text-white" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-lg font-black text-slate-900">Conexão realizada com sucesso!</h4>
                                        <p className="text-sm text-slate-500">Sua instância WhatsApp está pronta para uso.</p>
                                    </div>
                                    {(qrModalConnected.profileName || qrModalConnected.phoneNumber) && (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                                            {qrModalConnected.profileName && (
                                                <div className="flex items-center justify-center gap-2">
                                                    <Smartphone size={14} className="text-emerald-600" />
                                                    <span className="text-sm font-bold text-emerald-800">{qrModalConnected.profileName}</span>
                                                </div>
                                            )}
                                            {qrModalConnected.phoneNumber && (
                                                <p className="text-xs text-emerald-600">{qrModalConnected.phoneNumber}</p>
                                            )}
                                        </div>
                                    )}
                                    <button
                                        onClick={closeQrModal}
                                        className="w-full py-3 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-bold text-sm transition-colors"
                                    >
                                        Concluir
                                    </button>
                                </div>
                            ) : qrModal.qrcode ? (
                                <div className="space-y-4 text-center">
                                    <p className="text-sm text-slate-500">
                                        Abra o WhatsApp no seu celular, vá em <strong>Dispositivos Conectados</strong> e escaneie o QR Code abaixo.
                                    </p>
                                    <div className="bg-white p-4 rounded-2xl border border-slate-200 inline-block mx-auto shadow-sm">
                                        <img
                                            src={qrModal.qrcode}
                                            alt="QR Code WhatsApp"
                                            className="w-64 h-64 object-contain"
                                        />
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-xs text-amber-600">
                                        <RefreshCw size={12} className="animate-spin" />
                                        <span>Aguardando leitura do QR Code...</span>
                                    </div>
                                </div>
                            ) : qrModal.paircode ? (
                                <div className="space-y-4 text-center">
                                    <p className="text-sm text-slate-500">
                                        Use o código abaixo para parear no WhatsApp.
                                    </p>
                                    <div className="bg-slate-50 rounded-2xl px-8 py-6 border border-slate-200">
                                        <span className="text-3xl font-mono font-black text-slate-900 tracking-[0.3em]">
                                            {qrModal.paircode}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-xs text-amber-600">
                                        <RefreshCw size={12} className="animate-spin" />
                                        <span>Aguardando pareamento...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                    <Loader2 size={32} className="animate-spin text-slate-300" />
                                    <p className="text-sm text-slate-400">Gerando QR Code...</p>
                                </div>
                            )}

                            {!qrModalConnected.connected && (
                                <button
                                    onClick={closeQrModal}
                                    className="w-full py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors"
                                >
                                    Fechar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConnectionsTab;
