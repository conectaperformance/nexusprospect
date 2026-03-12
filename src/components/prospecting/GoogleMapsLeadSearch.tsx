import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    Zap,
    Timer,
    FolderPlus,
    X,
    ChevronLeft,
    ChevronRight,
    Copy,
} from 'lucide-react';
import SaveLeadsModal from './SaveLeadsModal';

interface GmapsLead {
    id: string;
    name: string;
    phone: string | null;
    company: string | null;
    website: string | null;
    address: string | null;
    rating: string | null;
    reviews: string | null;
    specialties: string | null;
    source: string;
    search_term: string | null;
    created_at: string;
}

const IDLE_POLL_INTERVAL = 30000; // 30s
const ACTIVE_POLL_INTERVAL = 5000; // 5s
const MAX_UNCHANGED_TICKS = 24; // 24 * 5s = 120s (2 minutes of no new leads before sleeping)
const ITEMS_PER_PAGE = 20;

const GoogleMapsLeadSearch: React.FC = () => {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [leads, setLeads] = useState<GmapsLead[]>([]);
    const [loading, setLoading] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const [webhookKey, setWebhookKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

    // Paginação
    const [currentPage, setCurrentPage] = useState(1);

    // Smart Polling States
    const [pollInterval, setPollInterval] = useState<number>(IDLE_POLL_INTERVAL);
    const [isActivelyPolling, setIsActivelyPolling] = useState(false);

    // Refs for Smart Polling internal logic
    const lastLeadsCountRef = useRef<number>(0);
    const unchangedTicksRef = useRef<number>(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Carregar leads do Supabase
    const fetchLeads = useCallback(async (isBackground = false) => {
        if (!user) return;
        if (!isBackground) setLoading(true); // Don't show loading spinner on background polls

        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('user_id', user.id)
                .eq('source', 'google_maps')
                .is('client_id', null)
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) throw error;

            const fetchedLeads = data || [];
            setLeads(fetchedLeads);

            // Smart Polling Logic: check if count changed
            if (isActivelyPolling) {
                if (fetchedLeads.length > lastLeadsCountRef.current) {
                    // We got new data! Reset sleep counter.
                    unchangedTicksRef.current = 0;
                    lastLeadsCountRef.current = fetchedLeads.length;
                } else {
                    // No new data
                    unchangedTicksRef.current += 1;
                    if (unchangedTicksRef.current >= MAX_UNCHANGED_TICKS) {
                        console.log('Extração inativa detectada. Retornando ao modo ocioso (30s).');
                        deactivateFastPolling();
                    }
                }
            } else {
                lastLeadsCountRef.current = fetchedLeads.length;
            }

        } catch (err) {
            console.error('Erro ao carregar leads:', err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    }, [user, isActivelyPolling]);

    // Setup the automated polling
    useEffect(() => {
        fetchLeads(); // initial fetch

        intervalRef.current = setInterval(() => {
            fetchLeads(true);
        }, pollInterval);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [fetchLeads, pollInterval]);

    const activateFastPolling = () => {
        setIsActivelyPolling(true);
        setPollInterval(ACTIVE_POLL_INTERVAL);
        unchangedTicksRef.current = 0;
        // Immediate fetch to start the flow immediately
        fetchLeads(true);
    };

    const deactivateFastPolling = () => {
        setIsActivelyPolling(false);
        setPollInterval(IDLE_POLL_INTERVAL);
        unchangedTicksRef.current = 0;
    };

    useEffect(() => {
        if (user) {
            const fetchKey = async () => {
                const { data, error } = await supabase.rpc('get_webhook_key', { p_user_id: user.id });
                if (!error) setWebhookKey(data || null);
            };
            fetchKey();
        }
    }, [user]);

    const copyWebhookUrl = () => {
        if (!webhookKey) return;
        const url = `https://${webhookKey}.conectalab.sbs/webhook?source=google_maps`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Abrir Google Maps com o termo de busca e ligar motores
    const openGoogleMaps = () => {
        if (!searchTerm.trim()) return;

        // Ativa o fast polling imediatamente quando o usuário viaja pro Maps
        activateFastPolling();

        const q = encodeURIComponent(searchTerm.trim());
        const url = `https://www.google.com/maps/search/${q}`;
        window.open(url, '_blank');
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

    // Deletar todos os leads
    const deleteAllLeads = async () => {
        if (!window.confirm('Tem certeza que deseja apagar TODOS os leads extraídos? Esta ação não pode ser desfeita.')) {
            return;
        }
        
        setLoading(true);
        try {
            // Remove apenas os leads da conta atual que originaram do maps e AINDA NÃO foram salvos em pastas
            const { error } = await supabase
                .from('leads')
                .delete()
                .eq('user_id', user?.id)
                .eq('source', 'google_maps')
                .is('client_id', null);
                
            if (error) throw error;
            
            setLeads([]);
            setSelectedLeads([]);
            setCurrentPage(1);
        } catch (err) {
            console.error('Erro ao deletar todos os leads:', err);
            alert('Não foi possível excluir todos os leads.');
        } finally {
            setLoading(false);
        }
    };

    // Alternar seleção
    const toggleSelect = (id: string) => {
        setSelectedLeads(prev => prev.includes(id) ? prev.filter(leadId => leadId !== id) : [...prev, id]);
    };

    // Alternar seleção de todos de um grupo
    const toggleAll = (termLeads: GmapsLead[]) => {
        const allSelected = termLeads.every(l => selectedLeads.includes(l.id));
        if (allSelected) {
            setSelectedLeads(prev => prev.filter(id => !termLeads.some(l => l.id === id)));
        } else {
            const newIds = termLeads.map(l => l.id).filter(id => !selectedLeads.includes(id));
            setSelectedLeads(prev => [...prev, ...newIds]);
        }
    };

    // Paginação
    const totalPages = Math.max(1, Math.ceil(leads.length / ITEMS_PER_PAGE));
    
    // Evitar que o usuário fique preso em uma página que não existe mais após deletar/mover
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [leads.length, currentPage, totalPages]);

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedLeads = leads.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // Agrupar leads por termo de busca APENAS baseados na página atual
    const searchTerms = [...new Set(paginatedLeads.map(l => l.search_term || 'Sem termo'))];

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-400">
            {/* Card Extensão */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
                            <MapPin className="text-red-500" size={24} />
                            Extrator de Leads — Google Maps
                        </h2>
                        <p className="text-slate-500 mt-1 text-xs">
                            Abra o Google Maps, faça sua busca por empresas e ative a extensão para enviar os leads para cá.
                        </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <a
                            href="/extension-gmaps/"
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                        >
                            <Download size={14} />
                            Baixar Extensão do Navegador
                        </a>

                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                            <Zap size={12} className="fill-emerald-500" />
                            Escutando Webhook
                        </div>
                    </div>
                </div>



                {/* Instructions */}
                <button
                    type="button"
                    onClick={() => setShowInstructions(!showInstructions)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                    <span className="flex items-center gap-2">Configurar pela 1ª vez <Chrome size={14} /></span>
                    {showInstructions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showInstructions && (
                    <div className="mt-3 bg-white border border-slate-200 rounded-2xl p-6 text-xs text-slate-600 space-y-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[10px]">1</span>
                                    Instalação
                                </h4>
                                <ol className="list-none space-y-2 ml-1 text-slate-500 border-l-2 border-slate-100 pl-4">
                                    <li>Baixe a extensão clicando em <strong>"Baixar Extensão do Navegador"</strong>.</li>
                                    <li>Descompacte o arquivo <code className="bg-slate-100 text-[10px] px-1 py-0.5 rounded text-amber-600">.zip</code> numa pasta no seu computador.</li>
                                    <li>No navegador (Chrome ou Opera), vá em <code className="bg-slate-100 font-bold px-1.5 py-0.5 rounded text-slate-700">chrome://extensions</code>.</li>
                                    <li>Ative o <strong>Modo do Desenvolvedor</strong> (canto superior direito).</li>
                                    <li>Clique em <strong>Carregar sem compactação</strong> e selecione a pasta da extensão.</li>
                                </ol>
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[10px]">2</span>
                                    Conexão Segura
                                </h4>
                                <ol className="list-none space-y-2 ml-1 text-slate-500 border-l-2 border-slate-100 pl-4">
                                    <li>Vá para <a href="/settings" className="font-bold text-blue-500 hover:underline">Configurações &rarr; Webhooks</a> e gere sua URL exclusiva caso ainda não o tenha feito.</li>
                                    <li>Copie a <strong>URL Exclusiva Completa</strong> clicando no botão abaixo:</li>
                                    {webhookKey ? (
                                        <div className="mt-2 mb-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                            <p className="text-[10px] text-slate-400 mb-1.5 font-medium uppercase tracking-wider">Seu Webhook para Google Maps</p>
                                            <div className="flex items-center gap-2">
                                                <code className="flex-1 bg-white border border-slate-200 text-[10px] px-2 py-1.5 rounded text-slate-600 truncate font-mono">
                                                    https://{webhookKey}.conectalab.sbs/webhook?source=google_maps
                                                </code>
                                                <button
                                                    onClick={copyWebhookUrl}
                                                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded transition-colors ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                                                >
                                                    {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                                                    {copied ? 'Copiado!' : 'Copiar'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-2 mb-2 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
                                            <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-[10px] text-amber-700">Você ainda não gerou sua Chave na aba de Configurações.</p>
                                        </div>
                                    )}
                                    <li>Abra o popup da extensão do Google Maps no seu navegador e <strong>cole o Webhook</strong> na área "Configurar Webhook".</li>
                                    <li>Pronto! Tudo que a extensão extrair cairá instantaneamente na tabela abaixo.</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Leads Table */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <Building2 size={20} className="text-slate-400" />
                            Leads Extraídos
                            {leads.length > 0 && (
                                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                                    {leads.length}
                                </span>
                            )}
                        </h3>
                        {/* Auto-update indicator */}
                        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-md">
                            <Timer size={10} className={isActivelyPolling ? 'text-amber-500' : 'text-slate-400'} />
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                Auto-Refresh: {isActivelyPolling ? '5s' : '30s'}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                        {leads.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedLeads(leads.map(l => l.id));
                                    setIsSaveModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900 transition-all shadow-md shadow-slate-900/20 active:scale-95"
                                title="Seleciona todos os leads e abre o menu de salvar"
                            >
                                <FolderPlus size={13} />
                                Salvar Todos ({leads.length})
                            </button>
                        )}
                        
                        {selectedLeads.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setIsSaveModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 active:scale-95 animate-in fade-in zoom-in-95 duration-200"
                            >
                                <CheckCircle2 size={13} />
                                Salvar {selectedLeads.length} Marcados
                            </button>
                        )}
                        {leads.length > 0 && (
                            <button
                                type="button"
                                onClick={deleteAllLeads}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-all active:scale-95 disabled:opacity-50"
                                title="Excluir todos os leads extraídos"
                            >
                                <Trash2 size={13} />
                                Excluir Todos
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => fetchLeads(false)}
                            disabled={loading || isActivelyPolling}
                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all
                                ${loading || isActivelyPolling
                                    ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-70'
                                    : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}
                        >
                            <RefreshCw size={13} className={loading || isActivelyPolling ? 'animate-spin' : ''} />
                            {isActivelyPolling ? 'Monitorando' : 'Atualizar'}
                        </button>
                    </div>
                </div>

                {leads.length > 0 ? (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {searchTerms.map(term => {
                            const termLeads = paginatedLeads.filter(l => (l.search_term || 'Sem termo') === term);
                            return (
                                <div key={term}>
                                    <div className="flex items-center gap-2 mb-2 ml-1">
                                        <div className="p-1 bg-slate-100 rounded-md">
                                            <Search size={10} className="text-slate-500" />
                                        </div>
                                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                            "{term}" <span className="text-slate-400 font-medium lowercase">({termLeads.length} contatos)</span>
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-white border-b border-slate-200 text-slate-400 select-none">
                                                        <th className="px-4 py-3 w-10">
                                                            <div 
                                                                className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${termLeads.length > 0 && termLeads.every(l => selectedLeads.includes(l.id)) ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white hover:border-blue-400'}`}
                                                                onClick={() => toggleAll(termLeads)}
                                                            >
                                                                {termLeads.length > 0 && termLeads.every(l => selectedLeads.includes(l.id)) && <CheckCircle2 size={12} className="text-white" />}
                                                                {termLeads.length > 0 && !termLeads.every(l => selectedLeads.includes(l.id)) && termLeads.some(l => selectedLeads.includes(l.id)) && <div className="w-2 h-2 rounded-[2px] bg-blue-500" />}
                                                            </div>
                                                        </th>
                                                        <th className="text-left px-2 py-3 font-bold text-[10px] uppercase tracking-wider">Empresa / Detalhes</th>
                                                        <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap">Telefone</th>
                                                        <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Métrica (Rating)</th>
                                                        <th className="text-left px-4 py-3 font-bold text-[10px] uppercase tracking-wider">Website / Fonte</th>
                                                        <th className="px-4 py-3 w-8"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {termLeads.map((lead) => (
                                                        <tr key={lead.id} className={`hover:bg-slate-50 transition-colors group ${selectedLeads.includes(lead.id) ? 'bg-blue-50/30' : ''}`}>
                                                            <td className="px-4 py-3.5 align-top pt-4">
                                                                <div 
                                                                    className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${selectedLeads.includes(lead.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white group-hover:border-blue-400'}`}
                                                                    onClick={() => toggleSelect(lead.id)}
                                                                >
                                                                    {selectedLeads.includes(lead.id) && <CheckCircle2 size={12} className="text-white" />}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-3.5">
                                                                <span className="font-bold text-slate-800 text-sm">{lead.name}</span>
                                                                {(lead.specialties || lead.address) && (
                                                                    <div className="text-[10px] text-slate-400 mt-1 flex flex-col gap-0.5">
                                                                        {lead.specialties && <span className="truncate max-w-[250px]">{lead.specialties}</span>}
                                                                        {lead.address && <span className="truncate max-w-[250px]">{lead.address}</span>}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3.5 align-top pt-4 whitespace-nowrap min-w-[140px]">
                                                                {lead.phone ? (
                                                                    <span className="flex w-fit items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md font-bold border border-emerald-100">
                                                                        <Phone size={10} className="fill-emerald-600" />
                                                                        {lead.phone}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[11px] text-slate-300 font-medium italic">Sem telefone</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3.5 align-top pt-4">
                                                                {lead.rating ? (
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="flex items-center gap-1 text-[11px] text-slate-700 font-bold">
                                                                            <Star size={12} className="fill-amber-400 text-amber-400" />
                                                                            {lead.rating}
                                                                        </span>
                                                                        {lead.reviews && (
                                                                            <span className="text-[10px] font-medium text-slate-400">{lead.reviews} avaliações</span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[11px] text-slate-300">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3.5 align-top pt-4">
                                                                {lead.website ? (
                                                                    <a
                                                                        href={lead.website}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-blue-600 font-bold max-w-[140px] truncate bg-slate-100 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors w-fit"
                                                                        title={lead.website}
                                                                    >
                                                                        <Globe size={10} />
                                                                        {(() => { try { return new URL(lead.website).hostname.replace('www.', ''); } catch { return lead.website; } })()}
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-[11px] text-slate-300">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3.5 align-middle">
                                                                {deleteConfirm === lead.id ? (
                                                                    <div className="flex flex-col items-center gap-1 bg-red-50 p-1.5 rounded-lg border border-red-100">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => deleteLead(lead.id)}
                                                                            className="text-[9px] font-black text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded w-full transition-colors"
                                                                        >
                                                                            APAGAR
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setDeleteConfirm(null)}
                                                                            className="text-[9px] font-bold text-slate-500 hover:text-slate-700"
                                                                        >
                                                                            CANCELAR
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDeleteConfirm(lead.id)}
                                                                        className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                                        title="Remover Lead"
                                                                    >
                                                                        <Trash2 size={14} />
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

                        {totalPages > 1 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-slate-100">
                                <p className="text-xs text-slate-500 font-medium">
                                    Mostrando de <span className="font-bold text-slate-800">{startIndex + 1}</span> a <span className="font-bold text-slate-800">{Math.min(startIndex + ITEMS_PER_PAGE, leads.length)}</span> de <span className="font-bold text-slate-800">{leads.length}</span> leads
                                </p>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                        title="Página Anterior"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    
                                    <div className="flex items-center gap-1 px-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                                            if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                                return (
                                                    <button
                                                        key={page}
                                                        type="button"
                                                        onClick={() => setCurrentPage(page)}
                                                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${currentPage === page ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                                    >
                                                        {page}
                                                    </button>
                                                );
                                            } else if (page === currentPage - 2 || page === currentPage + 2) {
                                                return <span key={page} className="text-slate-300 px-1.5 font-bold">...</span>;
                                            }
                                            return null;
                                        })}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                        title="Próxima Página"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-16 text-slate-400 bg-slate-50 border border-slate-100 rounded-2xl border-dashed">
                        <MapPin size={48} className="mx-auto mb-4 text-slate-300" />
                        <p className="font-bold text-slate-500 text-sm">Nenhum lead extraído ainda</p>
                        <p className="text-xs mt-1.5 max-w-sm mx-auto text-slate-400">
                            Configure seu Webhook na extensão, abra o Google Maps no seu navegador e inicie a extração. Os leads surgirão aqui sozinhos.
                        </p>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes shimmer {
                    100% {
                        transform: translateX(100%);
                    }
                }
            `}</style>
            
            {/* Save Modal */}
            <SaveLeadsModal
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                selectedLeadIds={selectedLeads}
                onSuccess={() => {
                    // Update table UI removing the moved leads and resetting selection
                    setLeads(prev => prev.filter(l => !selectedLeads.includes(l.id)));
                    setSelectedLeads([]);
                }}
            />
        </div>
    );
};

export default GoogleMapsLeadSearch;
