import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import {
    TrendingUp,
    Activity,
    Send,
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    LayoutDashboard,
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';

interface CampaignStat {
    id: string;
    name: string;
    status: string;
    created_at: string;
    sent_count: number;
    failed_count: number;
    total_leads: number;
}

type TimeFilter = '7' | '15' | '30' | 'all';

const Dashboard: React.FC = () => {
    const { profile, user } = useAuth();
    const userName = profile?.full_name?.split(' ')[0] || 'Gestor';

    const [loading, setLoading] = useState(true);
    const [campaigns, setCampaigns] = useState<CampaignStat[]>([]);

    const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    useEffect(() => {
        if (user?.id) {
            fetchDashboardData();
        }
    }, [user]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            // Step 1: Fetch campaigns (same query as CampaignMonitor)
            const { data: campaignsData, error: campError } = await supabase
                .from('campaigns')
                .select('id, name, status, created_at, configuration')
                .eq('user_id', user!.id)
                .order('created_at', { ascending: false });



            if (campError || !campaignsData || campaignsData.length === 0) {

                setCampaigns([]);
                setLoading(false);
                return;
            }

            // Step 2: Fetch messages for all campaigns (same as CampaignMonitor)
            const campaignIds = campaignsData.map(c => c.id);


            const { data: messagesData, error: msgError } = await supabase
                .from('campaign_messages')
                .select('campaign_id, status')
                .in('campaign_id', campaignIds);



            // Step 3: Aggregate stats per campaign (same as CampaignMonitor)
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



            // Step 4: Build result (same as CampaignMonitor)
            const result: CampaignStat[] = campaignsData.map(c => {
                const stats = statsMap[c.id];

                // Se campanha cancelada ou completed, pendentes viram falha
                if ((c.status === 'completed' || c.status === 'cancelled') && stats.pending > 0) {
                    stats.failed += stats.pending;
                    stats.pending = 0;
                }

                return {
                    id: c.id,
                    name: c.name,
                    status: c.status,
                    created_at: c.created_at,
                    sent_count: stats.sent,
                    failed_count: stats.failed,
                    total_leads: stats.total,
                };
            });


            setCampaigns(result);
        } catch (err) {
            console.error('[Dashboard] Erro ao buscar dados:', err);
        } finally {
            setLoading(false);
        }
    };

    // Memoize filtred campaigns and calculated stats to update instantly when filter changes
    const { filteredCampaigns, kpis, chartData } = useMemo(() => {
        let filtered = campaigns;

        // Filter by date
        if (timeFilter !== 'all') {
            const daysLimit = parseInt(timeFilter);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
            cutoffDate.setHours(0, 0, 0, 0);

            filtered = campaigns.filter(c => new Date(c.created_at) >= cutoffDate);
        }

        // KPIs calculation based on filtered data
        let totalSent = 0;
        let totalFailed = 0;
        let actives = 0;

        filtered.forEach(c => {
            totalSent += (c.sent_count || 0);
            totalFailed += (c.failed_count || 0);
            if (c.status === 'active' || c.status === 'in_progress') {
                actives++;
            }
        });

        const totalProcessed = totalSent + totalFailed;
        const successRate = totalProcessed > 0 ? (totalSent / totalProcessed) * 100 : 0;
        const failRate = totalProcessed > 0 ? (totalFailed / totalProcessed) * 100 : 0;

        // Chart Data Calculation
        let chartAggr: any[] = [];

        if (timeFilter === 'all') {
            // Group by Month (MM/YYYY) for 'All time'
            const monthlyData: Record<string, { Sucesso: number, Falha: number }> = {};

            // Generate last 6 months minimum or more based on data
            const now = new Date();
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                monthlyData[key] = { Sucesso: 0, Falha: 0 };
            }

            filtered.forEach(c => {
                const date = new Date(c.created_at);
                const key = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
                if (!monthlyData[key]) monthlyData[key] = { Sucesso: 0, Falha: 0 };
                monthlyData[key].Sucesso += (c.sent_count || 0);
                monthlyData[key].Falha += (c.failed_count || 0);
            });

            // Sort keys chronologically
            const sortedKeys = Object.keys(monthlyData).sort((a, b) => {
                const [m1, y1] = a.split('/');
                const [m2, y2] = b.split('/');
                return new Date(parseInt(y1), parseInt(m1) - 1).getTime() - new Date(parseInt(y2), parseInt(m2) - 1).getTime();
            });

            chartAggr = sortedKeys.map(key => ({
                name: key,
                Sucesso: monthlyData[key].Sucesso,
                Falha: monthlyData[key].Falha
            }));

        } else {
            // Group by Day for 7, 15, 30 days
            const daysLimit = parseInt(timeFilter);
            const dateRange = [...Array(daysLimit)].map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - ((daysLimit - 1) - i));
                return d.toISOString().split('T')[0]; // YYYY-MM-DD
            });

            chartAggr = dateRange.map(dateStr => {
                const dayCamps = filtered.filter(c => c.created_at.startsWith(dateStr));
                const daySent = dayCamps.reduce((acc, c) => acc + (c.sent_count || 0), 0);
                const dayFailed = dayCamps.reduce((acc, c) => acc + (c.failed_count || 0), 0);

                const [y, m, d] = dateStr.split('-');
                return {
                    name: `${d}/${m}`,
                    Sucesso: daySent,
                    Falha: dayFailed,
                };
            });
        }

        return {
            filteredCampaigns: filtered,
            chartData: chartAggr,
            kpis: {
                totalDisparos: totalProcessed,
                campanhasAtivas: actives,
                taxaSucesso: successRate,
                taxaFalha: failRate
            }
        };
    }, [campaigns, timeFilter]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setShowFilterMenu(false);
        if (showFilterMenu) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showFilterMenu]);

    const filterLabels: Record<TimeFilter, string> = {
        '7': 'Últimos 7 Dias',
        '15': 'Últimos 15 Dias',
        '30': 'Últimos 30 Dias',
        'all': 'Todo o Período',
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-brand-500 rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-500 font-medium animate-pulse">Carregando métricas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header - Premium Dark Hero */}
            <div className="relative bg-slate-900 rounded-3xl shadow-2xl shadow-slate-900/10">
                <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400 rounded-full blur-[100px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 p-8">
                    <div className="text-white">
                        <h1 className="text-3xl font-black mb-2 tracking-tight flex items-center gap-3">
                            <LayoutDashboard className="text-yellow-500" size={32} />
                            Dashboard
                        </h1>
                        <p className="text-slate-300 font-medium w-full">Métricas e visão geral da sua operação</p>
                    </div>

                    {/* Filter Dropdown */}
                    <div className="relative z-20">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowFilterMenu(!showFilterMenu); }}
                            className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm backdrop-blur-sm"
                        >
                            <span className="text-sm font-medium text-white">{filterLabels[timeFilter]}</span>
                            <ChevronDown size={16} className="text-slate-300" />
                        </button>

                        {showFilterMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 overflow-hidden z-30 animate-in slide-in-from-top-2">
                                {(Object.keys(filterLabels) as TimeFilter[]).map((key) => (
                                    <button
                                        key={key}
                                        onClick={() => { setTimeFilter(key); setShowFilterMenu(false); }}
                                        className={`w-full text-left px-4 py-3 text-sm transition-colors text-slate-700 ${timeFilter === key ? 'bg-[#F9C300]/10 text-slate-900 font-semibold' : 'hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                    >
                                        {filterLabels[key]}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Grid de Cards (Top Metrics) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 relative overflow-hidden group hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-center mb-1.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                            <Send size={16} strokeWidth={1.5} />
                        </div>
                    </div>
                    <h3 className="text-slate-500 text-sm font-semibold mb-0">Total de Disparos</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-900">{kpis.totalDisparos}</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 relative overflow-hidden group hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-center mb-1.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                            <Activity size={16} strokeWidth={1.5} />
                        </div>
                    </div>
                    <h3 className="text-slate-500 text-sm font-semibold mb-0">Campanhas Ativas</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-900">{kpis.campanhasAtivas}</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 relative overflow-hidden group hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-center mb-1.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                            <CheckCircle2 size={16} strokeWidth={1.5} />
                        </div>
                        {kpis.taxaSucesso > 0 && <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center"><TrendingUp size={12} className="mr-1" /> {kpis.taxaSucesso.toFixed(1)}%</span>}
                    </div>
                    <h3 className="text-slate-500 text-sm font-semibold mb-0">Taxa de Sucesso</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-900">{kpis.taxaSucesso.toFixed(1)}%</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 relative overflow-hidden group hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-center mb-1.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                            <AlertCircle size={16} strokeWidth={1.5} />
                        </div>
                        {kpis.taxaFalha > 0 && <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-full flex items-center"><TrendingUp size={12} className="mr-1" /> {kpis.taxaFalha.toFixed(1)}%</span>}
                    </div>
                    <h3 className="text-slate-500 text-sm font-semibold mb-0">Taxa de Falha</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-900">{kpis.taxaFalha.toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            {/* Central Area: Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Visão Geral dos Disparos</h2>
                        <p className="text-sm text-slate-500">Volume de mensagens processadas no período selecionado.</p>
                    </div>
                </div>

                {kpis.totalDisparos === 0 ? (
                    <div className="h-[350px] flex items-center justify-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                        <div className="text-center">
                            <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <span className="text-slate-500 font-medium">Nenhum dado de disparo no período</span>
                        </div>
                    </div>
                ) : (
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    interval={0}
                                    tick={{
                                        fill: '#94a3b8',
                                        fontSize: timeFilter === '30' ? 10 : timeFilter === '15' ? 11 : 12,
                                        fontWeight: 500,
                                    }}
                                    angle={timeFilter === '30' ? -45 : timeFilter === '15' ? -35 : 0}
                                    textAnchor={timeFilter === '30' || timeFilter === '15' ? 'end' : 'middle'}
                                    dy={timeFilter === '30' ? 10 : timeFilter === '15' ? 8 : 10}
                                    height={timeFilter === '30' ? 60 : timeFilter === '15' ? 50 : 35}
                                    tickMargin={5}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                                    width={45}
                                />
                                <Tooltip
                                    cursor={{ stroke: '#1e293b', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const sucesso = payload.find(p => p.dataKey === 'Sucesso');
                                            const falha = payload.find(p => p.dataKey === 'Falha');
                                            return (
                                                <div style={{
                                                    background: '#0f172a',
                                                    borderRadius: '10px',
                                                    padding: '12px 16px',
                                                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                                                    border: 'none',
                                                    minWidth: '140px',
                                                }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                                                            <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>Sucesso</span>
                                                            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700, marginLeft: 'auto' }}>
                                                                {sucesso?.value || 0}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b' }} />
                                                            <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>Falha</span>
                                                            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700, marginLeft: 'auto' }}>
                                                                {falha?.value || 0}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        marginTop: '8px',
                                                        paddingTop: '8px',
                                                        borderTop: '1px solid #334155',
                                                        color: '#64748b',
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        textTransform: 'uppercase' as const,
                                                        letterSpacing: '0.05em',
                                                    }}>
                                                        {label}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend
                                    verticalAlign="top"
                                    align="right"
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ paddingBottom: '20px', fontSize: '13px', fontWeight: 500 }}
                                    formatter={(value: string) => (
                                        <span style={{ color: '#475569', marginLeft: '4px' }}>{value}</span>
                                    )}
                                />
                                <Line
                                    type="monotone"
                                    name="Sucesso"
                                    dataKey="Sucesso"
                                    stroke="#10b981"
                                    strokeWidth={2.5}
                                    dot={false}
                                    activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2.5 }}
                                />
                                <Line
                                    type="monotone"
                                    name="Falha"
                                    dataKey="Falha"
                                    stroke="#64748b"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 5, fill: '#64748b', stroke: '#fff', strokeWidth: 2.5 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Tabela Inferior (Últimas Campanhas) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-900">Campanhas Recentes</h2>
                    <p className="text-sm text-slate-500">Acompanhamento detalhado das últimas execuções</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Campanha</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Sucessos</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Falhas</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Total Leads</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {campaigns.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                                        Nenhuma campanha para exibir.
                                    </td>
                                </tr>
                            ) : (
                                campaigns.slice(0, 5).map(camp => (
                                    <tr key={camp.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="font-bold text-slate-800 text-sm mb-1">{camp.name}</div>
                                            <div className="text-xs text-slate-400 font-medium">{new Date(camp.created_at).toLocaleDateString('pt-BR')}</div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold tracking-wide ${camp.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60' :
                                                    camp.status === 'active' || camp.status === 'in_progress' ? 'bg-blue-50 text-blue-600 border border-blue-200/60' :
                                                        camp.status === 'failed' ? 'bg-rose-50 text-rose-600 border border-rose-200/60' :
                                                            'bg-slate-100 text-slate-500 border border-slate-200/60'
                                                }`}>
                                                {camp.status === 'completed' ? 'Concluída' :
                                                    camp.status === 'active' ? 'Ativa' :
                                                        camp.status === 'in_progress' ? 'Progresso' :
                                                            camp.status === 'failed' ? 'Falha' :
                                                                camp.status === 'paused' ? 'Pausada' :
                                                                    'Pendente'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="inline-flex text-emerald-600 font-bold bg-emerald-50/80 px-2.5 py-1 rounded-md text-sm min-w-[32px] justify-center">
                                                {camp.sent_count || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            {camp.failed_count > 0 ? (
                                                <span className="inline-flex text-rose-500 font-bold bg-rose-50/80 px-2.5 py-1 rounded-md text-sm min-w-[32px] justify-center">
                                                    {camp.failed_count}
                                                </span>
                                            ) : (
                                                <span className="inline-flex text-rose-300 font-medium px-2.5 py-1 text-sm min-w-[32px] justify-center">
                                                    0
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className="font-bold text-slate-800 text-sm">
                                                {camp.total_leads || 0}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
