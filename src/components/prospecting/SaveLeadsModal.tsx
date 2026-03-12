import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import Modal from '../ui/Modal';
import { Folder, Building2, Plus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SaveLeadsModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedLeadIds: string[];
    onSuccess: () => void;
    sourceTable?: string;
}

export default function SaveLeadsModal({ isOpen, onClose, selectedLeadIds, onSuccess, sourceTable = 'leads' }: SaveLeadsModalProps) {
    const { user } = useAuth();
    const [clients, setClients] = useState<any[]>([]);
    const [folders, setFolders] = useState<any[]>([]);
    
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedFolderId, setSelectedFolderId] = useState<string>('');
    
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // States for quick creations
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            fetchClients();
            // Reset states
            setSelectedClientId('');
            setSelectedFolderId('');
            setIsCreatingClient(false);
            setIsCreatingFolder(false);
            setNewClientName('');
            setNewFolderName('');
        }
    }, [isOpen, user]);

    useEffect(() => {
        if (selectedClientId) {
            fetchFolders(selectedClientId);
        } else {
            setFolders([]);
        }
    }, [selectedClientId]);

    const fetchClients = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('id, name')
                .eq('user_id', user?.id)
                .order('name');
            if (!error) setClients(data || []);
        } finally {
            setLoading(false);
        }
    };

    const fetchFolders = async (clientId: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('lead_folders')
                .select('id, name')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false });
            if (!error) setFolders(data || []);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickCreateClient = async () => {
        if (!newClientName.trim()) return;
        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('clients')
                .insert([{ name: newClientName, user_id: user?.id, status: 'active' }])
                .select()
                .single();
            if (error) throw error;
            
            setClients([...clients, data]);
            setSelectedClientId(data.id);
            setIsCreatingClient(false);
            setNewClientName('');
        } catch (err) {
            console.error('Erro ao criar cliente', err);
        } finally {
            setSaving(false);
        }
    };

    const handleQuickCreateFolder = async () => {
        if (!newFolderName.trim() || !selectedClientId) return;
        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('lead_folders')
                .insert([{ name: newFolderName, client_id: selectedClientId, user_id: user?.id }])
                .select()
                .single();
            if (error) throw error;

            setFolders([data, ...folders]);
            setSelectedFolderId(data.id);
            setIsCreatingFolder(false);
            setNewFolderName('');
        } catch (err) {
            console.error('Erro ao criar pasta', err);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveLeads = async () => {
        if (!selectedClientId || !selectedFolderId || selectedLeadIds.length === 0) return;
        setSaving(true);
        try {
            if (sourceTable === 'leads') {
                // Original behavior: update in place
                const { error } = await supabase
                    .from('leads')
                    .update({ 
                        client_id: selectedClientId, 
                        folder_id: selectedFolderId 
                    })
                    .in('id', selectedLeadIds);

                if (error) throw error;
            } else {
                // Staging table behavior: copy to leads CRM, then delete from staging
                const { data: leadsToMove, error: fetchError } = await supabase
                    .from(sourceTable)
                    .select('*')
                    .in('id', selectedLeadIds);
                    
                if (fetchError) throw fetchError;

                if (leadsToMove && leadsToMove.length > 0) {
                    const mappedLeads = leadsToMove.map(lead => ({
                        ...lead,
                        phone: lead.phone ? lead.phone.replace(/whatsapp/ig, '').trim() : lead.phone,
                        client_id: selectedClientId,
                        folder_id: selectedFolderId
                    }));

                    const { error: insertError } = await supabase
                        .from('leads')
                        .insert(mappedLeads);
                    
                    if (insertError) throw insertError;

                    const { error: deleteError } = await supabase
                        .from(sourceTable)
                        .delete()
                        .in('id', selectedLeadIds);
                    
                    if (deleteError) throw deleteError;
                }
            }

            onSuccess();
            onClose();
        } catch (err) {
            console.error('Erro ao salvar leads', err);
            alert('Não foi possível salvar os leads selecionados.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Salvar ${selectedLeadIds.length} Leads`} size="md">
            <div className="space-y-6">
                {/* Etapa 1: Selecionar o Cliente */}
                <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[10px]">1</span>
                        Para qual Cliente?
                    </label>

                    {loading && clients.length === 0 ? (
                        <div className="py-4 text-center"><Loader2 size={18} className="animate-spin text-slate-400 mx-auto" /></div>
                    ) : (
                        <div className="space-y-3">
                            {!isCreatingClient ? (
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <select
                                            value={selectedClientId}
                                            onChange={(e) => setSelectedClientId(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 appearance-none font-medium text-slate-700"
                                        >
                                            <option value="" disabled>Selecione um cliente...</option>
                                            {clients.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setIsCreatingClient(true)}
                                        className="px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-2 border border-slate-200 shrink-0"
                                        title="Criar novo cliente"
                                    >
                                        <Plus size={16} /> Novo
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                                    <input 
                                        type="text" 
                                        placeholder="Nome Fantasia do novo cliente"
                                        value={newClientName}
                                        onChange={e => setNewClientName(e.target.value)}
                                        className="flex-1 px-4 py-2 text-sm bg-white border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
                                        autoFocus
                                    />
                                    <button 
                                        type="button" 
                                        onClick={handleQuickCreateClient}
                                        disabled={saving || !newClientName.trim()}
                                        className="px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Criar
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsCreatingClient(false)}
                                        className="px-3 py-2 text-slate-500 text-sm hover:bg-white rounded-lg"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            )}

                            {clients.length === 0 && !isCreatingClient && (
                                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                                    <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                                    <p className="text-xs text-amber-700 font-medium tracking-tight leading-relaxed">
                                        Você ainda não possui clientes cadastrados. Crie um rapidamente clicando em <strong>"Novo"</strong> ao lado.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Etapa 2: Selecionar a Pasta */}
                <div className={`space-y-3 transition-all duration-300 ${!selectedClientId ? 'opacity-40 pointer-events-none' : ''}`}>
                    <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${selectedClientId ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>2</span>
                        Qual Pasta?
                    </label>

                    <div className="space-y-3">
                        {!isCreatingFolder ? (
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Folder size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <select
                                        value={selectedFolderId}
                                        onChange={(e) => setSelectedFolderId(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 appearance-none font-medium text-slate-700"
                                    >
                                        <option value="" disabled>Selecione a pasta de origem...</option>
                                        {folders.map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <button 
                                        type="button"
                                        onClick={() => setIsCreatingFolder(true)}
                                        className="px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-2 border border-slate-200 shrink-0"
                                    >
                                        <Plus size={16} /> Nova
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-2 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                                    <input 
                                        type="text" 
                                        placeholder="Ex: Clínicas Odonto, Indústrias SP..."
                                        value={newFolderName}
                                        onChange={e => setNewFolderName(e.target.value)}
                                        className="flex-1 px-4 py-2 text-sm bg-white border border-emerald-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20"
                                        autoFocus
                                    />
                                    <button 
                                        type="button" 
                                        onClick={handleQuickCreateFolder}
                                        disabled={saving || !newFolderName.trim()}
                                        className="px-4 py-2 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        Criar
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsCreatingFolder(false)}
                                        className="px-3 py-2 text-slate-500 text-sm hover:bg-white rounded-lg"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                        )}

                        {selectedClientId && folders.length === 0 && !isCreatingFolder && (
                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                                <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-amber-700 font-medium tracking-tight leading-relaxed">
                                    Este cliente não tem nenhuma pasta. Crie a primeira clicando em <strong>"Nova"</strong>.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className={`mt-8 pt-4 border-t border-slate-100 flex justify-end gap-3 transition-opacity duration-300 ${!selectedClientId || !selectedFolderId ? 'opacity-40 pointer-events-none' : ''}`}>
                 <button 
                    type="button" 
                    onClick={onClose} 
                    className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg transition-colors"
                >
                    Cancelar
                </button>
                <button 
                    type="button" 
                    onClick={handleSaveLeads}
                    disabled={saving || !selectedClientId || !selectedFolderId} 
                    className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 flex items-center gap-2 shadow-lg shadow-slate-900/10"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                     Confirmar e Mover Leads
                </button>
            </div>
        </Modal>
    );
}
