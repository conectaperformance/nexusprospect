import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { Send, Image as ImageIcon, Users, Clock, AlignLeft, AlertCircle, CheckCircle2, Zap, Bot, Layers, X, ArrowRight, Building2, Folder, Smartphone, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CampaignMonitor from './CampaignMonitor';

export const WhatsAppCampaignForm: React.FC = () => {
    const [campaignType, setCampaignType] = useState<'simple' | 'ai' | 'multi-ai' | ''>('');
    const [name, setName] = useState('');
    const [minDelay, setMinDelay] = useState(15);
    const [maxDelay, setMaxDelay] = useState(30);
    const [messageDelay, setMessageDelay] = useState(5);
    const [messageText, setMessageText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [leads, setLeads] = useState<any[]>([]);
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [leadsPerPage, setLeadsPerPage] = useState(20);
    const [success, setSuccess] = useState(false);
    const [planLimit, setPlanLimit] = useState<number | null>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const { user, isStarter } = useAuth();
    const [clients, setClients] = useState<any[]>([]);
    const [folders, setFolders] = useState<any[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedFolderId, setSelectedFolderId] = useState<string>('');
    const [connections, setConnections] = useState<any[]>([]);
    const [selectedConnection, setSelectedConnection] = useState<string>('');
    const [selectedConnections, setSelectedConnections] = useState<string[]>([]);

    useEffect(() => {
        const fetchPlanLimit = async () => {
            try {
                const { data, error } = await supabase.functions.invoke('whatsapp-uazapi', {
                    body: { action: 'list' },
                });
                if (!error && data) {
                    setPlanLimit(data.plan_limit || 1);
                    if (data.connections && data.connections.length > 0) {
                        const activeConnections = data.connections.filter((c: any) => c.status === 'connected');
                        setConnections(activeConnections);
                        if (activeConnections.length > 0) {
                            setSelectedConnection(activeConnections[0].instance);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching plan limit:', err);
            }
        };
        fetchPlanLimit();
    }, []);

    useEffect(() => {
        const fetchClients = async () => {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from('clients')
                    .select('id, name')
                    .eq('user_id', user.id)
                    .order('name');
                if (!error && data) setClients(data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchClients();
    }, [user]);

    useEffect(() => {
        const fetchFoldersAndLeads = async () => {
            if (!selectedClientId) {
                setFolders([]);
                setLeads([]);
                return;
            }
            try {
                const { data: folderData } = await supabase
                    .from('lead_folders')
                    .select('id, name')
                    .eq('client_id', selectedClientId);
                setFolders(folderData || []);

                let query = supabase.from('leads').select('id, name, company, phone, website, address, rating, reviews, specialties').eq('client_id', selectedClientId).order('name');
                if (selectedFolderId) {
                    query = query.eq('folder_id', selectedFolderId);
                }
                const { data: leadsData } = await query;
                setLeads(leadsData || []);
                setSelectedLeads([]);
                setCurrentPage(1);
            } catch (err) {
                console.error(err);
            }
        };
        fetchFoldersAndLeads();
    }, [selectedClientId, selectedFolderId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Basic validation
        if (!campaignType) {
            alert('Por favor, selecione o tipo de disparo.');
            return;
        }
        if (!name.trim()) {
            alert('Por favor, insira o nome da campanha.');
            return;
        }
        if (!selectedConnection && campaignType !== 'multi-ai') {
            alert('Por favor, selecione uma instância do WhatsApp conectada.');
            return;
        }
        if (campaignType === 'multi-ai' && selectedConnections.length < 2) {
            alert('Erro: necessário selecionar pelo menos 2 instâncias para o disparo multi.');
            return;
        }
        if (selectedLeads.length === 0) {
            alert('Por favor, selecione ao menos um lead.');
            return;
        }

        setLoading(true);
        setSuccess(false);

        try {
            // Retrieve session and auth info
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;

            // 1. Save locally to Supabase 'campaigns' table (optional but recommended for history)
            const { data: campaignData, error: dbError } = await supabase
                .from('campaigns')
                .insert([{
                    name,
                    status: 'active',
                    type: 'whatsapp_marketing',
                    user_id: userId,
                    configuration: {
                        campaignType,
                        minDelay,
                        maxDelay,
                        messageDelay,
                        messageText: messageText || '',
                        selectedLeadsCount: selectedLeads.length,
                        clientId: selectedClientId,
                        folderId: selectedFolderId || null,
                        selectedConnection,
                        selectedConnections
                    }
                }])
                .select()
                .single();

            if (dbError) {
                console.error('Erro ao salvar campanha no banco local:', dbError);
                // Continue to webhook even if local save fails, or you can throw
            }

            // 1.1. Upload de mídia para Supabase Storage (independente do webhook)
            // Fire-and-forget: não bloqueia o envio do webhook
            if (file && campaignData?.id) {
                const uploadMediaToStorage = async () => {
                    try {
                        const fileExt = file.name.split('.').pop();
                        const storagePath = `${userId}/${campaignData.id}/${Date.now()}.${fileExt}`;

                        const { error: uploadError } = await supabase.storage
                            .from('campaign-media')
                            .upload(storagePath, file);

                        if (uploadError) {
                            console.warn('Erro ao fazer upload da mídia da campanha (não crítico):', uploadError);
                            return;
                        }

                        const { data: { publicUrl } } = supabase.storage
                            .from('campaign-media')
                            .getPublicUrl(storagePath);

                        // Atualizar configuration da campanha com a URL da mídia
                        await supabase
                            .from('campaigns')
                            .update({
                                configuration: {
                                    ...campaignData.configuration,
                                    mediaUrl: publicUrl,
                                    mediaType: file.type,
                                    mediaName: file.name,
                                }
                            })
                            .eq('id', campaignData.id);
                    } catch (err) {
                        console.warn('Falha no upload de mídia para Storage (não crítico):', err);
                    }
                };
                // Executar em paralelo sem bloquear o fluxo principal
                uploadMediaToStorage();
            }


            // 2. Prepare payload for N8N Webhook (JSON format)
            const convertFileToBase64 = (file: File): Promise<string> => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = (error) => reject(error);
                });
            };

            let fileBase64 = null;
            let fileMimeType = null;
            let fileName = null;

            if (file) {
                fileBase64 = await convertFileToBase64(file);
                fileMimeType = file.type;
                fileName = file.name;
            }

            const currentConn = connections.find(c => c.instance === selectedConnection);
            const currentFolder = folders.find(f => f.id === selectedFolderId);

            // Fetch the full details of the selected leads so N8N doesn't need to query them back
            const fullSelectedLeads = selectedLeads
                .map(id => leads.find(l => l.id === id))
                .filter(Boolean); // Remove null/undefined

            // 1.5. Inserir registros de campaign_messages com status 'pending'
            if (campaignData?.id) {
                const messagesToInsert = fullSelectedLeads.map((lead: any) => ({
                    campaign_id: campaignData.id,
                    lead_id: lead.id,
                    lead_name: lead.name || null,
                    lead_phone: lead.phone || null,
                    status: 'pending',
                }));

                // Inserir em batches de 100 para evitar timeout
                const batchSize = 100;
                for (let i = 0; i < messagesToInsert.length; i += batchSize) {
                    const batch = messagesToInsert.slice(i, i + batchSize);
                    const { error: msgError } = await supabase
                        .from('campaign_messages')
                        .insert(batch);
                    if (msgError) {
                        console.error('Erro ao inserir campaign_messages (batch):', msgError);
                    }
                }
                console.log(`Inseridos ${messagesToInsert.length} registros de campaign_messages como pending.`);
            }

            // Build instances data for the webhook
            let instancesData;
            if (campaignType === 'multi-ai') {
                instancesData = selectedConnections.map(inst => {
                    const conn = connections.find(c => c.instance === inst);
                    return {
                        instance: inst,
                        token: conn?.token || null,
                        profileName: conn?.profile_name || inst,
                        phoneNumber: conn?.phone_number || null,
                    };
                });
            } else {
                instancesData = [{
                    instance: selectedConnection,
                    token: currentConn?.token || null,
                    profileName: currentConn?.profile_name || selectedConnection,
                    phoneNumber: currentConn?.phone_number || null,
                }];
            }

            const payload = {
                campaignType,
                name,
                minDelay,
                maxDelay,
                messageDelay,
                messageText,
                selectedLeads: fullSelectedLeads,
                clientId: selectedClientId,
                folderId: selectedFolderId || null,
                folderName: currentFolder?.name || 'Todas as Pastas',
                userId: userId || '',
                campaignId: campaignData?.id || null,
                file: fileBase64,
                mimetype: fileMimeType,
                fileName: fileName,
                // Single instance (backward compatible)
                instance: campaignType === 'multi-ai' ? instancesData[0]?.instance : selectedConnection,
                instanceToken: campaignType === 'multi-ai' ? instancesData[0]?.token : (currentConn?.token || null),
                // Multi-instance data
                instances: instancesData,
                instanceCount: instancesData.length,
            };

            const webhookUrl = 'https://nexus360.infra-conectamarketing.site/webhook/nexus-disparos';

            console.log('Enviando dados para o webhook de teste...', webhookUrl);

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Falha no envio do webhook: ${response.statusText}`);
            }

            console.log('Webhook disparado com sucesso!', await response.text());

            setSuccess(true);

            // Optional: Limpa form após sucesso 
            setTimeout(() => {
                setSuccess(false);
                setName('');
                setMessageText('');
                setSelectedLeads([]);
                setFile(null);
                setCampaignType('');
                setSelectedClientId('');
                setSelectedFolderId('');
                setSelectedConnections([]);
                // Keep the same selected instance to make it easier for subsequent campaigns
            }, 3000);

        } catch (error: any) {
            console.error('Erro ao criar campanha:', error);
            alert(`Houve um erro ao processar a campanha: ${error.message || 'Tente novamente.'}`);
        } finally {
            setLoading(false);
        }
    };

    const toggleLeadSelection = (leadId: string) => {
        setSelectedLeads(prev =>
            prev.includes(leadId)
                ? prev.filter(id => id !== leadId)
                : [...prev, leadId]
        );
    };

    const selectAllLeads = () => {
        if (selectedLeads.length === leads.length && leads.length > 0) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(leads.map(l => l.id));
        }
    };

    const selectLeadsBatch = (count: number) => {
        // Seleciona os primeiros N leads que ainda não estão selecionados
        const unselectedLeads = leads.filter(l => !selectedLeads.includes(l.id));
        const toSelect = unselectedLeads.slice(0, count).map(l => l.id);
        setSelectedLeads(prev => [...prev, ...toSelect]);
    };

    const currentPageLeads = leads.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);
    const currentPageLeadIds = currentPageLeads.map(l => l.id);
    const allCurrentPageSelected = currentPageLeads.length > 0 && currentPageLeadIds.every(id => selectedLeads.includes(id));

    const toggleSelectCurrentPage = () => {
        if (allCurrentPageSelected) {
            // Desmarcar apenas os leads da página atual
            setSelectedLeads(prev => prev.filter(id => !currentPageLeadIds.includes(id)));
        } else {
            // Marcar os leads da página atual que ainda não estão selecionados
            const toAdd = currentPageLeadIds.filter(id => !selectedLeads.includes(id));
            setSelectedLeads(prev => [...prev, ...toAdd]);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 md:p-10 shadow-sm border border-slate-200 animate-in slide-in-from-bottom-2 duration-400">
            <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                    <Send className="text-brand-500" size={28} />
                    Configuração da Campanha
                </h2>
                <p className="text-slate-500 mt-2 font-medium">
                    Crie uma nova campanha de disparo no WhatsApp, ajuste os detalhes e selecione seus leads.
                </p>
            </div>

            <div className="mb-10">
                <label className="block text-sm font-bold text-slate-700 mb-4">Selecione o Tipo de Disparo *</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                        type="button"
                        onClick={() => setCampaignType(campaignType === 'simple' ? '' : 'simple')}
                        className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 ${campaignType === 'simple' ? 'border-slate-900 bg-slate-900 shadow-xl transform -translate-y-1' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                        <Zap className={`mb-3 ${campaignType === 'simple' ? 'text-yellow-500' : 'text-slate-400'}`} size={32} />
                        <span className={`font-bold ${campaignType === 'simple' ? 'text-white' : 'text-slate-700'}`}>Disparo Simples</span>
                        <span className={`text-xs text-center mt-2 ${campaignType === 'simple' ? 'text-slate-300' : 'text-slate-500'}`}>Envio de mensagens em massa padrão.</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setCampaignType(campaignType === 'ai' ? '' : 'ai')}
                        className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 ${campaignType === 'ai' ? 'border-slate-900 bg-slate-900 shadow-xl transform -translate-y-1' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                        <Bot className={`mb-3 ${campaignType === 'ai' ? 'text-yellow-500' : 'text-slate-400'}`} size={32} />
                        <span className={`font-bold ${campaignType === 'ai' ? 'text-white' : 'text-slate-700'}`}>Disparo com IA</span>
                        <span className={`text-xs text-center mt-2 ${campaignType === 'ai' ? 'text-slate-300' : 'text-slate-500'}`}>Envio de mensagens em massa personalizado com IA.</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (isStarter) return;
                            setCampaignType(campaignType === 'multi-ai' ? '' : 'multi-ai');
                        }}
                        className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 ${isStarter ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-70' : campaignType === 'multi-ai' ? 'border-slate-900 bg-slate-900 shadow-xl transform -translate-y-1' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                        {isStarter && (
                            <div className="absolute top-3 right-3 bg-red-100 text-red-600 p-1.5 rounded-lg flex items-center justify-center shadow-sm">
                                <Lock size={14} />
                            </div>
                        )}
                        <Layers className={`mb-3 ${isStarter ? 'text-slate-300' : campaignType === 'multi-ai' ? 'text-yellow-500' : 'text-slate-400'}`} size={32} />
                        <span className={`font-bold ${isStarter ? 'text-slate-400' : campaignType === 'multi-ai' ? 'text-white' : 'text-slate-700'}`}>Multi-Instância com IA</span>
                        <span className={`text-xs text-center mt-2 ${isStarter ? 'text-slate-400' : campaignType === 'multi-ai' ? 'text-slate-300' : 'text-slate-500'}`}>Distribui os envios com IA entre vários números.</span>
                        {isStarter && (
                            <div className="mt-4 bg-slate-200 text-slate-500 text-[10px] uppercase tracking-wider font-bold py-1 px-3 rounded-full">
                                Plano Pro
                            </div>
                        )}
                    </button>
                </div>

                {/* Monitoramento de Campanhas (posição padrão: tipo não selecionado) */}
                {!campaignType && (
                    <div className="mt-6">
                        <CampaignMonitor />
                    </div>
                )}
            </div>

            {campaignType && (
                <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    {/* Instância do WhatsApp */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <Smartphone size={16} className="text-slate-400" />
                            {campaignType === 'multi-ai' ? 'Instâncias do WhatsApp *' : 'Instância do WhatsApp *'}
                        </label>

                        {campaignType === 'multi-ai' ? (
                            /* Multi-instance: checkbox list */
                            <>
                                {connections.length > 0 && (
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-semibold text-slate-500">
                                            {selectedConnections.length} de {connections.length} instâncias selecionadas
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (selectedConnections.length === connections.length) {
                                                    setSelectedConnections([]);
                                                } else {
                                                    setSelectedConnections(connections.map(c => c.instance));
                                                }
                                            }}
                                            className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 py-1.5 px-3 rounded-lg transition-colors border border-slate-200"
                                        >
                                            {selectedConnections.length === connections.length ? 'Desmarcar todas' : 'Selecionar todas'}
                                        </button>
                                    </div>
                                )}
                                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                                    {connections.map(c => (
                                        <label key={c.instance} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={selectedConnections.includes(c.instance)}
                                                onChange={() => {
                                                    setSelectedConnections(prev =>
                                                        prev.includes(c.instance)
                                                            ? prev.filter(i => i !== c.instance)
                                                            : [...prev, c.instance]
                                                    );
                                                }}
                                                className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500/50"
                                            />
                                            <div>
                                                <span className="text-sm font-bold text-slate-800">{c.profile_name || c.instance}</span>
                                                {c.phone_number && <span className="text-xs text-slate-400 ml-2">({c.phone_number})</span>}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </>
                        ) : (
                            /* Single instance: dropdown */
                            <select
                                value={selectedConnection}
                                onChange={(e) => setSelectedConnection(e.target.value)}
                                required
                                className="w-full bg-white border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all font-medium"
                            >
                                <option value="">Selecione uma instância conectada...</option>
                                {connections.map(c => (
                                    <option key={c.instance} value={c.instance}>
                                        {c.profile_name || c.instance} {c.phone_number ? `(${c.phone_number})` : ''}
                                    </option>
                                ))}
                            </select>
                        )}

                        {connections.length === 0 && (
                            <p className="text-xs text-red-500 mt-2 font-medium flex items-center gap-1">
                                <AlertCircle size={12} />
                                Nenhuma instância do WhatsApp conectada. Vá em Configurações para conectar.
                            </p>
                        )}
                    </div>

                    {/* 1. Nome da Campanha */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">1. Nome da Campanha *</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Oferta Black Friday 2026"
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all font-medium"
                        />
                    </div>

                    {/* 2. Delay Mínimo e Máximo */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <label className="block text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <Clock size={16} className="text-slate-400" />
                            2. Intervalo de Disparo Base (Delay Mínimo e Máximo)
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Mínimo (Segundos)</span>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={minDelay}
                                    onChange={(e) => setMinDelay(Number(e.target.value))}
                                    className="w-full bg-white border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all font-medium"
                                />
                            </div>
                            <div>
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Máximo (Segundos)</span>
                                <input
                                    type="number"
                                    required
                                    min={minDelay}
                                    value={maxDelay}
                                    onChange={(e) => setMaxDelay(Number(e.target.value))}
                                    className="w-full bg-white border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all font-medium"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                            <AlertCircle size={12} />
                            Define o tempo aleatório de espera entre o envio para leads diferentes.
                        </p>
                    </div>

                    {/* 4. Delay entre mensagens (mova a ordem visual pra facilitar agrupamento de tempo) */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">3. Delay entre as mensagens (segundos) *</label>
                        <input
                            type="number"
                            required
                            min="1"
                            value={messageDelay}
                            onChange={(e) => setMessageDelay(Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all font-medium"
                        />
                        <p className="text-xs text-slate-400 mt-2">
                            Tempo de espera caso você envie mídia e texto separados para o mesmo lead.
                        </p>
                    </div>

                    <div className={`grid grid-cols-1 ${campaignType === 'simple' ? 'md:grid-cols-2' : ''} gap-8`}>
                        {/* 3. Upload de Mídia (Opcional) — Apenas para Disparo Simples */}
                        {campaignType === 'simple' && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">4. Mídia (Opcional)</label>
                                <label className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-colors h-48 ${file ? 'border-brand-400 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'}`}>
                                    {file ? (
                                        <div className="text-center">
                                            <CheckCircle2 className="text-brand-500 mb-2 mx-auto" size={32} />
                                            <span className="text-sm font-bold text-slate-800 block truncate max-w-[200px]">{file.name}</span>
                                            <span className="text-xs text-brand-600 mt-1 block">Clique para trocar</span>
                                        </div>
                                    ) : (
                                        <div className="text-center text-slate-500">
                                            <ImageIcon className="mb-3 mx-auto" size={32} />
                                            <span className="text-sm font-bold block mb-1">Upload de Imagem/Vídeo/Áudio</span>
                                            <span className="text-xs text-slate-400">Formatos suportados (PNG, JPG, MP4, MP3)</span>
                                        </div>
                                    )}
                                    <input type="file" className="hidden" accept="image/*,video/*,audio/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                                </label>
                            </div>
                        )}

                        {/* 5. Caixa de texto (Opcional) */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <AlignLeft size={16} className="text-slate-400" />
                                {campaignType === 'simple' ? '5. Mensagem de Texto (Opcional)' : '4. Mensagem de Texto (Opcional)'}
                            </label>
                            <textarea
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                placeholder="Olá {nome}, tudo bem? Temos uma oportunidade incrível..."
                                className="w-full h-48 bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all font-medium resize-none"
                            ></textarea>
                        </div>
                    </div>

                    {/* 6. Selecionar Cliente e Pasta */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <Building2 size={16} className="text-slate-400" />
                                    6. Cliente
                                </label>
                                <select
                                    value={selectedClientId}
                                    onChange={(e) => {
                                        setSelectedClientId(e.target.value);
                                        setSelectedFolderId('');
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all font-medium"
                                >
                                    <option value="">Selecione um cliente...</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <Folder size={16} className="text-slate-400" />
                                    7. Pasta de Leads (Opcional)
                                </label>
                                <select
                                    value={selectedFolderId}
                                    onChange={(e) => setSelectedFolderId(e.target.value)}
                                    disabled={!selectedClientId}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all font-medium disabled:opacity-50"
                                >
                                    <option value="">Todas as Pastas</option>
                                    {folders.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mb-4 mt-6">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Users size={18} className="text-slate-400" />
                                8. Selecionar Leads ({leads.length})
                            </label>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5">
                                    {[20, 50, 100].map(n => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => { setLeadsPerPage(n); setCurrentPage(1); }}
                                            className={`text-xs font-bold px-2.5 py-1 rounded-md transition-all ${leadsPerPage === n
                                                ? 'bg-white text-slate-800 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                    <span className="text-[10px] text-slate-400 pr-1.5">/ pág</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {selectedLeads.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedLeads([])}
                                            className="text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 py-1.5 px-3 rounded-lg transition-colors"
                                        >
                                            Desmarcar ({selectedLeads.length})
                                        </button>
                                    )}
                                    <div className="relative group/page">
                                        <button
                                            type="button"
                                            onClick={toggleSelectCurrentPage}
                                            className={`text-xs font-bold py-1.5 px-3 rounded-lg transition-colors ${allCurrentPageSelected
                                                ? 'text-amber-700 bg-amber-100 hover:bg-amber-200'
                                                : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                                                }`}
                                        >
                                            {allCurrentPageSelected ? `Página ${currentPage} ✓` : `Página ${currentPage}`}
                                        </button>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-[10px] font-medium rounded-lg whitespace-nowrap opacity-0 invisible group-hover/page:opacity-100 group-hover/page:visible transition-all duration-200 pointer-events-none shadow-lg z-50">
                                            {allCurrentPageSelected
                                                ? 'Clique para desmarcar os leads desta página'
                                                : `Selecionar apenas os ${currentPageLeads.length} leads visíveis nesta página`
                                            }
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                                        </div>
                                    </div>
                                    {[20, 50, 100].map(n => (
                                        <button
                                            key={`sel-${n}`}
                                            type="button"
                                            onClick={() => selectLeadsBatch(n)}
                                            disabled={selectedLeads.length >= leads.length}
                                            className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 py-1.5 px-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            title={`Selecionar +${n} leads`}
                                        >
                                            +{n}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={selectAllLeads}
                                        className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 py-1.5 px-3 rounded-lg transition-colors"
                                    >
                                        {selectedLeads.length === leads.length && leads.length > 0 ? 'Todos ✓' : 'Todos'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden max-h-[520px] overflow-y-auto">
                            {leads.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    Nenhum lead encontrado.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {leads
                                        .slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage)
                                        .map((lead) => (
                                            <label key={lead.id} className="flex items-center gap-3 py-2 px-3 hover:bg-white cursor-pointer transition-colors">
                                                <div className="flex-shrink-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedLeads.includes(lead.id)}
                                                        onChange={() => toggleLeadSelection(lead.id)}
                                                        className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500/50"
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-sm text-slate-800 truncate">{lead.name || 'Lead sem nome'}</p>
                                                    <p className="text-[11px] font-medium text-slate-400 truncate">
                                                        {lead.company && <span className="mr-2">{lead.company}</span>}
                                                        {lead.phone && <span>{lead.phone.replace(/whatsapp/ig, '').trim()}</span>}
                                                    </p>
                                                </div>
                                            </label>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Paginação */}
                        {leads.length > leadsPerPage && (
                            <div className="flex items-center justify-center gap-1.5 mt-3">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 py-1.5 px-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    ← Anterior
                                </button>
                                {Array.from({ length: Math.ceil(leads.length / leadsPerPage) }, (_, i) => i + 1)
                                    .filter(p => {
                                        const total = Math.ceil(leads.length / leadsPerPage);
                                        if (total <= 7) return true;
                                        if (p === 1 || p === total) return true;
                                        if (Math.abs(p - currentPage) <= 1) return true;
                                        return false;
                                    })
                                    .map((p, idx, arr) => (
                                        <React.Fragment key={p}>
                                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                                                <span className="text-xs text-slate-300 px-1">…</span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setCurrentPage(p)}
                                                className={`text-xs font-bold w-8 h-8 rounded-lg transition-all ${currentPage === p
                                                    ? 'bg-slate-900 text-white shadow-sm'
                                                    : 'text-slate-500 hover:bg-slate-100'
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        </React.Fragment>
                                    ))}
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(leads.length / leadsPerPage), p + 1))}
                                    disabled={currentPage === Math.ceil(leads.length / leadsPerPage)}
                                    className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 py-1.5 px-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Próximo →
                                </button>
                            </div>
                        )}

                        <p className="text-xs font-semibold text-slate-500 mt-2 text-right">
                            {selectedLeads.length} de {leads.length} leads selecionados
                        </p>
                    </div>

                    {/* 7. Criar Campanha */}
                    <div className="pt-6 border-t border-slate-100 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading || !name || !campaignType}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-900/20"
                        >
                            {loading ? (
                                <div className="w-5 h-5 relative flex items-center justify-center">
                                    <div className="absolute inset-0 rounded-full border-2 border-white/20"></div>
                                    <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                                </div>
                            ) : success ? (
                                <CheckCircle2 size={20} className="text-green-400" />
                            ) : (
                                <Send size={20} />
                            )}
                            <span>{loading ? 'Criando...' : success ? 'Campanha Criada!' : 'Criar Campanha'}</span>
                        </button>
                    </div>

                    {/* Monitoramento de Campanhas (posição: após formulário) */}
                    <div className="mt-2">
                        <CampaignMonitor />
                    </div>
                </div>
            )}

            {/* Upgrade Modal */}
            {showUpgradeModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                <Layers className="text-amber-500" size={20} />
                                Recurso Premium
                            </h3>
                            <button
                                onClick={() => setShowUpgradeModal(false)}
                                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 text-center space-y-6">
                            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                                <Layers size={40} className="text-amber-500" />
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-xl font-black text-slate-900">Faça um Upgrade</h4>
                                <p className="text-slate-500 text-sm">
                                    O Disparo Multi-Instância permite distribuir suas mensagens entre vários números diferentes de forma simultânea. Para utilizar essa função, você precisa de um plano com <strong className="text-slate-700">3 ou mais instâncias</strong> conectadas.
                                </p>
                            </div>
                            <div className="space-y-3 pt-4">
                                <button
                                    onClick={() => {
                                        // TODO: The user will provide the link soon
                                        window.open('https://example.com/upgrade', '_blank');
                                        setShowUpgradeModal(false);
                                    }}
                                    className="w-full py-4 bg-amber-500 text-white hover:bg-amber-600 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2"
                                >
                                    Fazer Upgrade de Plano
                                    <ArrowRight size={18} />
                                </button>
                                <button
                                    onClick={() => setShowUpgradeModal(false)}
                                    className="w-full py-3 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
};
