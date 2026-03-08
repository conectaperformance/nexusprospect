import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    Activity,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Send,
    AlertCircle,
    PartyPopper,
    AlertTriangle,
    StopCircle,
    Trash2,
    Ban,
    Eye,
    X,
    Image as ImageIcon,
    AlignLeft,
    Zap,
    Bot,
    Layers,
    Users,
    Timer,
    Smartphone
} from 'lucide-react';

interface CampaignStats {
    id: string;
    name: string;
    status: string;
    created_at: string;
    configuration: any;
    total: number;
    sent: number;
    failed: number;
    pending: number;
}

const REFRESH_INTERVAL = 30000; // 30 segundos

const CampaignMonitor: React.FC = () => {
    const { user } = useAuth();
    const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [detailsCampaign, setDetailsCampaign] = useState<CampaignStats | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchCampaigns = useCallback(async () => {
        if (!user) return;

        try {
            const { data: campaignsData, error: campError } = await supabase
                .from('campaigns')
                .select('id, name, status, created_at, configuration')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (campError || !campaignsData || campaignsData.length === 0) {
                setCampaigns([]);
                setLoading(false);
                return;
            }

            const campaignIds = campaignsData.map(c => c.id);

            const { data: messagesData, error: msgError } = await supabase
                .from('campaign_messages')
                .select('campaign_id, status')
                .in('campaign_id', campaignIds);

            if (msgError) {
                console.error('Erro ao buscar messages:', msgError);
            }

            const statsMap: Record<string, { total: number; sent: number; failed: number; pending: number }> = {};
            campaignIds.forEach(id => {
                statsMap[id] = { total: 0, sent: 0, failed: 0, pending: 0 };
            });

            if (messagesData) {
                messagesData.forEach((msg: any) => {
                    const s = statsMap[msg.campaign_id];
                    if (s) {
                        s.total++;
                        if (msg.status === 'sent') s.sent++;
                        else if (msg.status === 'failed') s.failed++;
                        else s.pending++;
                    }
                });
            }

            const result: CampaignStats[] = campaignsData.map(c => {
                const stats = statsMap[c.id];

                // Se campanha cancelada ou completed, pendentes viram falha
                if ((c.status === 'completed' || c.status === 'cancelled') && stats.pending > 0) {
                    stats.failed += stats.pending;
                    stats.pending = 0;
                }

                const processed = stats.sent + stats.failed;

                // Auto-marcar como completed se todos processados
                if (stats.total > 0 && stats.pending === 0 && processed >= stats.total && c.status === 'active') {
                    supabase
                        .from('campaigns')
                        .update({ status: 'completed' })
                        .eq('id', c.id)
                        .then(() => { });
                    c.status = 'completed';
                }

                return {
                    id: c.id,
                    name: c.name,
                    status: c.status,
                    created_at: c.created_at,
                    configuration: c.configuration,
                    ...stats,
                };
            });

            setCampaigns(result);
            setLastUpdate(new Date());
        } catch (err) {
            console.error('Erro ao buscar campanhas:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Initial load
    useEffect(() => {
        fetchCampaigns();
    }, [fetchCampaigns]);

    // Auto-refresh
    useEffect(() => {
        intervalRef.current = setInterval(fetchCampaigns, REFRESH_INTERVAL);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [fetchCampaigns]);

    // === ACTIONS ===

    const handleStopCampaign = async (campaignId: string) => {
        setActionLoading(campaignId);
        try {
            // 1. Marcar campanha como 'cancelled'
            await supabase
                .from('campaigns')
                .update({ status: 'cancelled' })
                .eq('id', campaignId);

            // 2. Marcar todos os pendentes como 'failed'
            await supabase
                .from('campaign_messages')
                .update({ status: 'failed', error_message: 'Campanha cancelada pelo usuário' })
                .eq('campaign_id', campaignId)
                .eq('status', 'pending');

            // Refresh
            await fetchCampaigns();
        } catch (err) {
            console.error('Erro ao parar campanha:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteCampaign = async (campaignId: string) => {
        setActionLoading(campaignId);
        try {
            // Delete cascade vai remover campaign_messages também
            await supabase
                .from('campaigns')
                .delete()
                .eq('id', campaignId);

            setConfirmDelete(null);
            await fetchCampaigns();
        } catch (err) {
            console.error('Erro ao excluir campanha:', err);
        } finally {
            setActionLoading(null);
        }
    };

    // === HELPERS ===

    const getProgressPercent = (c: CampaignStats) => {
        if (c.total === 0) return 0;
        return Math.round(((c.sent + c.failed) / c.total) * 100);
    };

    const getCampaignStatusInfo = (c: CampaignStats) => {
        if (c.status === 'cancelled') {
            return { label: 'Cancelada', color: 'text-red-700', bg: 'bg-red-50', dotColor: 'bg-red-500' };
        }
        if (c.total === 0) return { label: 'Sem envios', color: 'text-slate-400', bg: 'bg-slate-100', dotColor: 'bg-slate-300' };

        const processed = c.sent + c.failed;
        const isComplete = processed >= c.total || c.status === 'completed';

        if (isComplete && c.failed === 0 && c.pending === 0) {
            return { label: 'Finalizada ✓', color: 'text-emerald-700', bg: 'bg-emerald-50', dotColor: 'bg-emerald-500' };
        }
        if (isComplete && c.failed > 0) {
            return { label: `Finalizada • ${c.failed} falha${c.failed !== 1 ? 's' : ''}`, color: 'text-amber-700', bg: 'bg-amber-50', dotColor: 'bg-amber-500' };
        }
        if (c.pending > 0 && processed > 0) {
            return { label: 'Enviando...', color: 'text-blue-700', bg: 'bg-blue-50', dotColor: 'bg-blue-500 animate-pulse' };
        }
        if (c.pending > 0 && processed === 0) {
            return { label: 'Aguardando', color: 'text-blue-700', bg: 'bg-blue-50', dotColor: 'bg-blue-500 animate-pulse' };
        }
        return { label: 'Em andamento', color: 'text-blue-700', bg: 'bg-blue-50', dotColor: 'bg-blue-500 animate-pulse' };
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const getCampaignTypeLabel = (config: any) => {
        const t = config?.campaignType;
        if (t === 'simple') return 'Simples';
        if (t === 'ai') return 'IA';
        if (t === 'multi-ai') return 'Multi-IA';
        return '—';
    };

    const isActive = (c: CampaignStats) => {
        return c.status === 'active' && c.total > 0 && c.pending > 0;
    };

    const isFinished = (c: CampaignStats) => {
        const processed = c.sent + c.failed;
        return (processed >= c.total && c.total > 0) || c.status === 'completed' || c.status === 'cancelled';
    };

    // === RENDER ===

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center gap-3 text-slate-400">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm font-medium">Carregando campanhas...</span>
                </div>
            </div>
        );
    }

    if (campaigns.length === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Header */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                        <Activity size={16} className="text-yellow-400" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-bold text-slate-800">Monitoramento de Campanhas</h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                            Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • Auto-refresh 15s
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); fetchCampaigns(); }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Atualizar agora"
                    >
                        <RefreshCw size={14} />
                    </button>
                    {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
            </button>

            {/* Campaigns List */}
            {expanded && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {campaigns.map((c) => {
                        const progress = getProgressPercent(c);
                        const statusInfo = getCampaignStatusInfo(c);
                        const processed = c.sent + c.failed;
                        const finished = isFinished(c);
                        const active = isActive(c);

                        return (
                            <div key={c.id} className={`px-6 py-4 transition-colors ${finished ? 'bg-slate-50/30' : 'hover:bg-slate-50/50'}`}>
                                {/* Row 1: Name + Status + Actions */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <h4 className="text-sm font-bold text-slate-800 truncate">{c.name}</h4>
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                            {getCampaignTypeLabel(c.configuration)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusInfo.bg} ${statusInfo.color}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
                                            {statusInfo.label}
                                        </div>
                                        <span className="text-[10px] text-slate-300">{formatDate(c.created_at)}</span>
                                    </div>
                                </div>

                                {/* Row 2: Progress Bar */}
                                {c.total > 0 && (
                                    <>
                                        <div className="flex items-center gap-3 mb-1.5">
                                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full flex">
                                                    <div
                                                        className="bg-emerald-500 transition-all duration-500"
                                                        style={{ width: `${c.total > 0 ? (c.sent / c.total) * 100 : 0}%` }}
                                                    />
                                                    <div
                                                        className="bg-red-400 transition-all duration-500"
                                                        style={{ width: `${c.total > 0 ? (c.failed / c.total) * 100 : 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-600 tabular-nums w-10 text-right">
                                                {progress}%
                                            </span>
                                        </div>

                                        {/* Row 3: Stats */}
                                        <div className="flex items-center gap-4 text-[11px] font-medium">
                                            <span className="flex items-center gap-1 text-slate-500">
                                                <Send size={11} />
                                                <span className="font-bold text-slate-700">{processed}</span>/{c.total} enviados
                                            </span>
                                            <span className="flex items-center gap-1 text-emerald-600">
                                                <CheckCircle2 size={11} />
                                                <span className="font-bold">{c.sent}</span> sucesso
                                            </span>
                                            {c.failed > 0 && (
                                                <span className="flex items-center gap-1 text-red-500">
                                                    <XCircle size={11} />
                                                    <span className="font-bold">{c.failed}</span> falha{c.failed !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                            {c.pending > 0 && (
                                                <span className="flex items-center gap-1 text-slate-400">
                                                    <Clock size={11} />
                                                    <span className="font-bold">{c.pending}</span> pendente{c.pending !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>

                                        {/* Finished Banner */}
                                        {finished && c.status !== 'cancelled' && (
                                            <div className={`mt-3 px-3 py-2 rounded-lg text-[11px] font-bold flex items-center gap-2 ${c.failed === 0
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}>
                                                {c.failed === 0 ? (
                                                    <>
                                                        <PartyPopper size={14} />
                                                        Campanha finalizada com sucesso! Todos os {c.sent} leads foram enviados.
                                                    </>
                                                ) : (
                                                    <>
                                                        <AlertTriangle size={14} />
                                                        Campanha finalizada. {c.sent} enviado{c.sent !== 1 ? 's' : ''} com sucesso, {c.failed} com falha.
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Cancelled Banner */}
                                        {c.status === 'cancelled' && (
                                            <div className="mt-3 px-3 py-2 rounded-lg text-[11px] font-bold flex items-center gap-2 bg-red-50 text-red-700 border border-red-200">
                                                <Ban size={14} />
                                                Campanha cancelada. {c.sent} enviado{c.sent !== 1 ? 's' : ''} antes do cancelamento{c.failed > 0 ? `, ${c.failed} com falha` : ''}.
                                            </div>
                                        )}
                                    </>
                                )}

                                {c.total === 0 && (
                                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                                        <AlertCircle size={11} />
                                        Nenhum envio registrado para esta campanha.
                                    </p>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
                                    {/* Ver Detalhes */}
                                    <button
                                        type="button"
                                        onClick={() => setDetailsCampaign(c)}
                                        className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        <Eye size={12} />
                                        Ver Detalhes
                                    </button>

                                    {/* Parar - só mostra se campanha está ativa com pendentes */}
                                    {active && (
                                        <button
                                            type="button"
                                            onClick={() => handleStopCampaign(c.id)}
                                            disabled={actionLoading === c.id}
                                            className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {actionLoading === c.id ? (
                                                <RefreshCw size={12} className="animate-spin" />
                                            ) : (
                                                <StopCircle size={12} />
                                            )}
                                            Parar Campanha
                                        </button>
                                    )}

                                    {/* Excluir */}
                                    {confirmDelete === c.id ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-red-600">Tem certeza?</span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteCampaign(c.id)}
                                                disabled={actionLoading === c.id}
                                                className="flex items-center gap-1 text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {actionLoading === c.id ? (
                                                    <RefreshCw size={11} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={11} />
                                                )}
                                                Sim, excluir
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setConfirmDelete(null)}
                                                className="text-[11px] font-bold text-slate-500 hover:text-slate-700 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDelete(c.id)}
                                            disabled={actionLoading === c.id}
                                            className="flex items-center gap-1.5 text-[11px] font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 size={12} />
                                            Excluir
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ============ MODAL DE DETALHES DA CAMPANHA ============ */}
            {detailsCampaign && (() => {
                const dc = detailsCampaign;
                const config = dc.configuration || {};
                const statusInfo = getCampaignStatusInfo(dc);
                const progress = getProgressPercent(dc);
                const processed = dc.sent + dc.failed;
                const successRate = dc.total > 0 ? ((dc.sent / dc.total) * 100).toFixed(1) : '0';

                const typeLabel = config.campaignType === 'simple' ? 'Disparo Simples'
                    : config.campaignType === 'ai' ? 'Disparo com IA'
                        : config.campaignType === 'multi-ai' ? 'Multi-Instância com IA' : 'N/A';

                const TypeIcon = config.campaignType === 'simple' ? Zap
                    : config.campaignType === 'ai' ? Bot
                        : config.campaignType === 'multi-ai' ? Layers : Zap;

                const isImage = config.mediaType?.startsWith('image/');
                const isVideo = config.mediaType?.startsWith('video/');
                const isAudio = config.mediaType?.startsWith('audio/');

                return (
                    <div
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setDetailsCampaign(null)}
                    >
                        <div
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-5 border-b border-slate-100 bg-slate-900 text-white relative">
                                <button
                                    onClick={() => setDetailsCampaign(null)}
                                    className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                >
                                    <X size={18} />
                                </button>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                                        <TypeIcon size={20} className="text-yellow-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black tracking-tight">{dc.name}</h3>
                                        <p className="text-xs text-slate-400 font-medium">{typeLabel} • {formatDate(dc.created_at)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusInfo.bg} ${statusInfo.color}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
                                        {statusInfo.label}
                                    </div>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="overflow-y-auto max-h-[calc(85vh-130px)] p-6 space-y-5">

                                {/* Estatísticas */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <Activity size={13} />
                                        Estatísticas
                                    </h4>
                                    <div className="grid grid-cols-4 gap-3">
                                        <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                                            <p className="text-xl font-black text-slate-800">{dc.total}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Total</p>
                                        </div>
                                        <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                                            <p className="text-xl font-black text-emerald-600">{dc.sent}</p>
                                            <p className="text-[10px] font-bold text-emerald-500 uppercase mt-0.5">Enviados</p>
                                        </div>
                                        <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
                                            <p className="text-xl font-black text-red-600">{dc.failed}</p>
                                            <p className="text-[10px] font-bold text-red-400 uppercase mt-0.5">Falhas</p>
                                        </div>
                                        <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                                            <p className="text-xl font-black text-blue-600">{dc.pending}</p>
                                            <p className="text-[10px] font-bold text-blue-400 uppercase mt-0.5">Pendentes</p>
                                        </div>
                                    </div>
                                    {dc.total > 0 && (
                                        <div className="mt-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[11px] font-bold text-slate-500">Progresso</span>
                                                <span className="text-[11px] font-bold text-slate-700">{progress}% • Taxa de sucesso: {successRate}%</span>
                                            </div>
                                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full flex">
                                                    <div
                                                        className="bg-emerald-500 transition-all duration-500"
                                                        style={{ width: `${dc.total > 0 ? (dc.sent / dc.total) * 100 : 0}%` }}
                                                    />
                                                    <div
                                                        className="bg-red-400 transition-all duration-500"
                                                        style={{ width: `${dc.total > 0 ? (dc.failed / dc.total) * 100 : 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Instância Utilizada */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <Smartphone size={13} />
                                        {config.campaignType === 'multi-ai' ? 'Instâncias Utilizadas' : 'Instância Utilizada'}
                                    </h4>
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        {config.campaignType === 'multi-ai' && config.selectedConnections?.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {config.selectedConnections.map((conn: string, idx: number) => (
                                                    <span key={idx} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-sm">
                                                        {conn}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-sm">
                                                {config.selectedConnection || 'Instância não informada (Campanha antiga)'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Mensagem de Texto */}
                                {config.messageText && (
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                            <AlignLeft size={13} />
                                            Mensagem de Texto
                                        </h4>
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                                                {config.messageText}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Mídia */}
                                {config.mediaUrl && (
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                            <ImageIcon size={13} />
                                            Mídia Anexada
                                        </h4>
                                        <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                            {isImage && (
                                                <img
                                                    src={config.mediaUrl}
                                                    alt={config.mediaName || 'Mídia da campanha'}
                                                    className="w-full max-h-80 object-contain bg-slate-100"
                                                />
                                            )}
                                            {isVideo && (
                                                <video
                                                    src={config.mediaUrl}
                                                    controls
                                                    className="w-full max-h-80"
                                                />
                                            )}
                                            {isAudio && (
                                                <div className="p-4">
                                                    <audio src={config.mediaUrl} controls className="w-full" />
                                                </div>
                                            )}
                                            <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
                                                <span className="text-xs font-bold text-slate-600 truncate">{config.mediaName || 'Arquivo'}</span>
                                                <span className="text-[10px] font-medium text-slate-400 uppercase">{config.mediaType}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Sem conteúdo */}
                                {!config.messageText && !config.mediaUrl && (
                                    <div className="bg-slate-50 rounded-xl p-6 text-center border border-slate-100">
                                        <AlignLeft size={24} className="text-slate-300 mx-auto mb-2" />
                                        <p className="text-sm font-medium text-slate-400">Nenhum conteúdo de texto ou mídia registrado para esta campanha.</p>
                                    </div>
                                )}

                                {/* Configurações de Disparo */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <Timer size={13} />
                                        Configurações de Disparo
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Delay Mínimo</p>
                                            <p className="text-sm font-black text-slate-800">{config.minDelay || '—'}s</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Delay Máximo</p>
                                            <p className="text-sm font-black text-slate-800">{config.maxDelay || '—'}s</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Delay entre Mensagens</p>
                                            <p className="text-sm font-black text-slate-800">{config.messageDelay || '—'}s</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                                                <Users size={10} />
                                                Leads Selecionados
                                            </p>
                                            <p className="text-sm font-black text-slate-800">{config.selectedLeadsCount || dc.total || '—'}</p>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default CampaignMonitor;
