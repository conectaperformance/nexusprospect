import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    MapPin,
    Search,
    ExternalLink,
    Download,
    Trash2,
    RefreshCw,
    Star,
    Phone,
    Globe,
    Building2,
    MessageSquare,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    AlertCircle,
    Link2,
    Unlink,
    Chrome,
} from 'lucide-react';

interface GmapsLead {
    id: string;
    name: string;
    phone: string | null;
    company: string | null;
    company_site: string | null;
    address: string | null;
    rating: string | null;
    reviews: string | null;
    specialties: string | null;
    source: string;
    search_term: string | null;
    created_at: string;
}

const GoogleMapsLeadSearch: React.FC = () => {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [leads, setLeads] = useState<GmapsLead[]>([]);
    const [loading, setLoading] = useState(false);
    const [synced, setSynced] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Verificar se extensão está sincronizada
    useEffect(() => {
        const token = localStorage.getItem('nexus360_ext_synced');
        setSynced(!!token);
    }, []);

    // Carregar leads do Supabase
    const fetchLeads = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('user_id', user.id)
                .eq('source', 'google_maps')
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) throw error;
            setLeads(data || []);
        } catch (err) {
            console.error('Erro ao carregar leads:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchLeads();
        // Auto-refresh a cada 30 segundos
        const interval = setInterval(fetchLeads, 30000);
        return () => clearInterval(interval);
    }, [fetchLeads]);

    // Abrir Google Maps com o termo de busca
    const openGoogleMaps = () => {
        if (!searchTerm.trim()) return;
        const q = encodeURIComponent(searchTerm.trim());
        const url = `https://www.google.com/maps/search/${q}`;
        window.open(url, '_blank');
    };

    // Sincronizar extensão - salva token no localStorage para extensão ler
    const syncExtension = async () => {
        if (!user) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert('Sessão expirada. Faça login novamente.');
            return;
        }

        // Salvar no localStorage para extensão ler via chrome.storage
        localStorage.setItem('nexus360_ext_token', session.access_token);
        localStorage.setItem('nexus360_ext_user_id', user.id);
        localStorage.setItem('nexus360_ext_user_email', user.email || '');
        localStorage.setItem('nexus360_ext_synced', 'true');

        // Tentar salvar no chrome.storage diretamente (se extensão instalada)
        try {
            if ((window as any).chrome?.storage?.local) {
                (window as any).chrome.storage.local.set({
                    nexus360_token: session.access_token,
                    nexus360_user_id: user.id,
                    nexus360_user_email: user.email || '',
                });
            }
        } catch { }

        setSynced(true);
    };

    // Desconectar extensão
    const unsyncExtension = () => {
        localStorage.removeItem('nexus360_ext_token');
        localStorage.removeItem('nexus360_ext_user_id');
        localStorage.removeItem('nexus360_ext_user_email');
        localStorage.removeItem('nexus360_ext_synced');
        try {
            if ((window as any).chrome?.storage?.local) {
                (window as any).chrome.storage.local.remove(['nexus360_token', 'nexus360_user_id', 'nexus360_user_email']);
            }
        } catch { }
        setSynced(false);
    };

    // Deletar lead individual
    const deleteLead = async (id: string) => {
        try {
            const { error } = await supabase.from('leads').delete().eq('id', id);
            if (error) throw error;
            setLeads(prev => prev.filter(l => l.id !== id));
            setDeleteConfirm(null);
        } catch (err) {
            console.error('Erro ao deletar lead:', err);
        }
    };

    // Agrupar leads por termo de busca
    const searchTerms = [...new Set(leads.map(l => l.search_term || 'Sem termo'))];

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-400">
            {/* Card Extensão */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
                            <MapPin className="text-red-500" size={24} />
                            Extrator de Leads — Google Maps
                        </h2>
                        <p className="text-slate-500 mt-1 text-xs">
                            Extraia leads automaticamente do Google Maps usando a extensão do navegador.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {synced ? (
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
                                    <CheckCircle2 size={14} />
                                    Extensão sincronizada
                                </span>
                                <button
                                    type="button"
                                    onClick={unsyncExtension}
                                    className="text-xs font-bold text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors"
                                    title="Desconectar extensão"
                                >
                                    <Unlink size={14} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={syncExtension}
                                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
                            >
                                <Link2 size={14} />
                                Sincronizar Extensão
                            </button>
                        )}
                    </div>
                </div>

                {/* Status não sincronizado */}
                {!synced && (
                    <div className="mb-6 px-5 py-4 bg-amber-50 border border-amber-200 rounded-2xl">
                        <p className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-2">
                            <AlertCircle size={16} />
                            Extensão não conectada
                        </p>
                        <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
                            <li>Baixe a extensão clicando no botão abaixo</li>
                            <li>Abra <code className="bg-amber-100 px-1.5 py-0.5 rounded font-bold">chrome://extensions</code> no navegador</li>
                            <li>Ative o <strong>"Modo do desenvolvedor"</strong> (canto superior direito)</li>
                            <li>Clique em <strong>"Carregar sem compactação"</strong> e selecione a pasta da extensão</li>
                            <li>Volte aqui e clique em <strong>"Sincronizar Extensão"</strong></li>
                        </ol>
                        <a
                            href="/extension-gmaps/"
                            download
                            className="inline-flex items-center gap-2 mt-3 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            <Download size={14} />
                            Baixar Extensão
                        </a>
                    </div>
                )}

                {/* Search Section */}
                <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200 p-5 mb-5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Termo de Busca
                    </label>
                    <div className="flex gap-2.5">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && openGoogleMaps()}
                                placeholder="ex.: advogado em BH, dentista em curitiba"
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={openGoogleMaps}
                            disabled={!searchTerm.trim() || !synced}
                            className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-slate-900/20"
                        >
                            <ExternalLink size={15} />
                            Abrir no Maps
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                        💡 Dica: use "profissão + cidade". A extensão iniciará a extração automaticamente ao abrir o Maps.
                    </p>
                </div>

                {/* Instructions */}
                <button
                    type="button"
                    onClick={() => setShowInstructions(!showInstructions)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors mb-5"
                >
                    <span>Como funciona?</span>
                    {showInstructions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showInstructions && (
                    <div className="mb-5 bg-slate-50 border border-slate-100 rounded-2xl p-5 text-xs text-slate-600 space-y-2 animate-in slide-in-from-top-2 duration-300">
                        <ol className="list-decimal list-inside space-y-1.5">
                            <li>Instale a extensão e clique em <strong>"Sincronizar Extensão"</strong></li>
                            <li>Digite o termo de busca e clique <strong>"Abrir no Maps"</strong></li>
                            <li>O Google Maps abrirá em nova aba — a extensão inicia <strong>automaticamente</strong></li>
                            <li>Um painel na tela mostrará o <strong>progresso: barra, contadores e nomes</strong></li>
                            <li>Cada lead extraído é <strong>enviado automaticamente</strong> para o Nexus360</li>
                            <li>Volte aqui — os leads já estarão na tabela abaixo <strong>(atualiza a cada 30s)</strong></li>
                        </ol>
                    </div>
                )}
            </div>

            {/* Leads Table */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Building2 size={20} className="text-slate-400" />
                        Leads Extraídos
                        {leads.length > 0 && (
                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                                {leads.length}
                            </span>
                        )}
                    </h3>
                    <button
                        type="button"
                        onClick={fetchLeads}
                        disabled={loading}
                        className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                </div>

                {leads.length > 0 ? (
                    <div className="space-y-4">
                        {searchTerms.map(term => {
                            const termLeads = leads.filter(l => (l.search_term || 'Sem termo') === term);
                            return (
                                <div key={term}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Search size={12} className="text-slate-400" />
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            "{term}" — {termLeads.length} leads
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-slate-100 text-slate-500">
                                                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider">Empresa</th>
                                                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider">Telefone</th>
                                                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider">Endereço</th>
                                                        <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider">Website</th>
                                                        <th className="text-center px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider">⭐</th>
                                                        <th className="text-center px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider">Reviews</th>
                                                        <th className="px-3 py-2.5 w-8"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {termLeads.map((lead) => (
                                                        <tr key={lead.id} className="hover:bg-white transition-colors">
                                                            <td className="px-3 py-2.5">
                                                                <span className="font-bold text-slate-800 text-xs">{lead.name}</span>
                                                                {lead.specialties && (
                                                                    <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]">{lead.specialties}</p>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5">
                                                                {lead.phone ? (
                                                                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                                                                        <Phone size={10} />
                                                                        {lead.phone}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[11px] text-slate-300">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5">
                                                                <span className="text-[11px] text-slate-500 truncate block max-w-[160px]">{lead.address || '—'}</span>
                                                            </td>
                                                            <td className="px-3 py-2.5">
                                                                {lead.company_site ? (
                                                                    <a
                                                                        href={lead.company_site}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 font-medium truncate max-w-[120px]"
                                                                    >
                                                                        <Globe size={10} />
                                                                        {(() => { try { return new URL(lead.company_site).hostname.replace('www.', ''); } catch { return lead.company_site; } })()}
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-[11px] text-slate-300">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                {lead.rating ? (
                                                                    <span className="flex items-center justify-center gap-0.5 text-[11px] text-amber-600 font-bold">
                                                                        <Star size={10} className="fill-amber-400 text-amber-400" />
                                                                        {lead.rating}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[11px] text-slate-300">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                {lead.reviews ? (
                                                                    <span className="text-[11px] text-slate-500 font-medium">{lead.reviews}</span>
                                                                ) : (
                                                                    <span className="text-[11px] text-slate-300">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5">
                                                                {deleteConfirm === lead.id ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => deleteLead(lead.id)}
                                                                            className="text-[10px] font-bold text-red-500 hover:text-red-700"
                                                                        >
                                                                            Sim
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setDeleteConfirm(null)}
                                                                            className="text-[10px] font-bold text-slate-400"
                                                                        >
                                                                            Não
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDeleteConfirm(lead.id)}
                                                                        className="text-slate-300 hover:text-red-500 transition-colors"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10 text-slate-400">
                        <MapPin size={40} className="mx-auto mb-3 text-slate-200" />
                        <p className="font-bold text-slate-500 text-sm">Nenhum lead extraído ainda</p>
                        <p className="text-[11px] mt-1">
                            Sincronize a extensão, busque no Google Maps e os leads aparecerão aqui automaticamente.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GoogleMapsLeadSearch;
