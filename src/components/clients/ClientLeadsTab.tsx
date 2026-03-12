import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { Lead, LeadFolder } from '../../types';
import { Folder, Users, Plus, Upload, Search, Trash2, MoreVertical, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { useAuth } from '../../contexts/AuthContext';

interface ClientLeadsTabProps {
    clientId: string;
}

export const ClientLeadsTab: React.FC<ClientLeadsTabProps> = ({ clientId }) => {
    const [folders, setFolders] = useState<LeadFolder[]>([]);
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const [leads, setLeads] = useState<Lead[]>([]);
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [activeModal, setActiveModal] = useState<'none' | 'new-folder' | 'new-lead' | 'import-leads'>('none');
    const [modalLoading, setModalLoading] = useState(false);

    const [newFolderName, setNewFolderName] = useState('');
    const [newLeadForm, setNewLeadForm] = useState({ name: '', phone: '', company: '', website: '' });
    const [importText, setImportText] = useState('');

    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Folders
            const { data: folderData, error: folderError } = await supabase
                .from('lead_folders')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false });

            if (folderError) throw folderError;

            const loadedFolders = folderData || [];
            setFolders(loadedFolders);

            if (loadedFolders.length > 0 && !activeFolderId) {
                setActiveFolderId(loadedFolders[0].id);
            }

            // 2. Fetch Leads for active folder (or all if no active folder)
            let leadsQuery = supabase.from('leads').select('*').eq('client_id', clientId);
            if (activeFolderId) {
                leadsQuery = leadsQuery.eq('folder_id', activeFolderId);
            }

            const { data: leadsData, error: leadsError } = await leadsQuery.order('created_at', { ascending: false });
            if (leadsError) throw leadsError;

            setLeads(leadsData || []);

        } catch (err) {
            console.error('Error fetching leads data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [clientId, activeFolderId]);

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;
        setModalLoading(true);
        try {
            const { data, error } = await supabase
                .from('lead_folders')
                .insert([{ name: newFolderName, client_id: clientId, user_id: user?.id }])
                .select()
                .single();

            if (error) throw error;

            setNewFolderName('');
            setActiveModal('none');
            setActiveFolderId(data.id);
            fetchData();
        } catch (err) {
            console.error('Erro ao criar pasta:', err);
            alert('Erro ao criar pasta.');
        } finally {
            setModalLoading(false);
        }
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!confirm('Excluir esta pasta? Todos os leads dentro dela também serão removidos.')) return;
        try {
            const { error } = await supabase.from('lead_folders').delete().eq('id', folderId);
            if (error) throw error;
            if (activeFolderId === folderId) setActiveFolderId(null);
            fetchData();
        } catch (err) {
            console.error('Erro ao excluir pasta:', err);
        }
    };

    const handleCreateLead = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeFolderId) {
            alert('Crie ou selecione uma pasta primeiro.');
            return;
        }
        setModalLoading(true);
        try {
            const { error } = await supabase
                .from('leads')
                .insert([{
                    ...newLeadForm,
                    client_id: clientId,
                    folder_id: activeFolderId
                }]);

            if (error) throw error;

            setNewLeadForm({ name: '', phone: '', company: '', website: '' });
            setActiveModal('none');
            fetchData();
        } catch (err) {
            console.error('Erro ao criar lead:', err);
            alert('Erro ao adicionar lead.');
        } finally {
            setModalLoading(false);
        }
    };

    const handleImportLeads = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeFolderId || !importText.trim()) return;
        setModalLoading(true);
        try {
            const lines = importText.split('\n').filter(l => l.trim() !== '');
            const newLeads = lines.map(line => {
                // Ex: Lucas Renato - 43999572256
                const parts = line.split('-').map(p => p.trim());
                return {
                    name: parts[0] || 'Desconhecido',
                    phone: parts[1] || parts[0] || '',
                    client_id: clientId,
                    folder_id: activeFolderId
                }
            });

            if (newLeads.length === 0) return;

            const { error } = await supabase
                .from('leads')
                .insert(newLeads);

            if (error) throw error;

            setImportText('');
            setActiveModal('none');
            fetchData();
            alert(`${newLeads.length} leads importados com sucesso!`);
        } catch (error) {
            console.error('Erro ao importar leads:', error);
            alert('Erro ao realizar a importação em massa.');
        } finally {
            setModalLoading(false);
        }
    };

    const handleDeleteLead = async (leadId: string) => {
        if (!confirm('Remover lead?')) return;
        try {
            const { error } = await supabase.from('leads').delete().eq('id', leadId);
            if (error) throw error;
            fetchData();
        } catch (err) {
            console.error(err);
        }
    }

    const filteredLeads = leads.filter(l =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        (l.phone && l.phone.includes(search))
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Folders Sidebar */}
                <div className="w-full lg:w-64 shrink-0 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Pastas</h3>
                        <button onClick={() => setActiveModal('new-folder')} className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-600 transition-colors">
                            <Plus size={16} />
                        </button>
                    </div>

                    <div className="space-y-1">
                        {folders.length === 0 ? (
                            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl">
                                <p className="text-sm text-slate-400 font-medium">Nenhuma pasta criada.</p>
                            </div>
                        ) : (
                            folders.map(folder => (
                                <div key={folder.id} className="group flex items-center justify-between">
                                    <button
                                        onClick={() => setActiveFolderId(folder.id)}
                                        className={`flex-1 flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-left ${activeFolderId === folder.id
                                            ? 'bg-slate-900 text-white shadow-md'
                                            : 'hover:bg-slate-100 text-slate-600'
                                            }`}
                                    >
                                        <Folder size={18} className={activeFolderId === folder.id ? 'text-amber-400' : 'text-slate-400'} />
                                        <span className="font-bold text-sm truncate">{folder.name}</span>
                                    </button>

                                    {/* Ocultar delete quando a pasta for recem criada se preferir, ou deixar disponivel sempre para o admin */}
                                    <button
                                        onClick={() => handleDeleteFolder(folder.id)}
                                        className={`p-2 ml-1 rounded-xl text-rose-400 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all`}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Leads Content */}
                <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">

                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 space-y-4 md:space-y-0 md:flex flex-row justify-between items-center bg-slate-50/50">
                            <div className="relative max-w-xs w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar lead..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    disabled={!activeFolderId}
                                    onClick={() => setActiveModal('import-leads')}
                                    className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 disabled:opacity-50 text-sm font-bold shadow-sm transition-all"
                                >
                                    <Upload size={16} />
                                    <span className="hidden sm:inline">Importar Leads</span>
                                </button>
                                <button
                                    disabled={!activeFolderId}
                                    onClick={() => setActiveModal('new-lead')}
                                    className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 text-sm font-bold shadow-lg shadow-slate-900/10 transition-all"
                                >
                                    <Plus size={16} />
                                    <span className="hidden sm:inline">Novo Lead</span>
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex justify-center p-20"><Loader2 size={32} className="animate-spin text-slate-300" /></div>
                            ) : !activeFolderId ? (
                                <div className="flex flex-col items-center justify-center p-20 text-center">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <Folder size={32} className="text-slate-300" />
                                    </div>
                                    <h3 className="font-bold text-slate-700 text-lg">Selecione ou crie uma pasta</h3>
                                    <p className="text-slate-500 text-sm mt-1">Os leads são organizados em pastas para melhor gestão da sua audiência.</p>
                                </div>
                            ) : filteredLeads.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-20 text-center">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <Users size={32} className="text-slate-300" />
                                    </div>
                                    <h3 className="font-bold text-slate-700 text-lg">Nenhum lead encontrado</h3>
                                    <p className="text-slate-500 text-sm mt-1">Adicione manualmente ou importe sua lista de contatos para esta pasta.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider backdrop-blur-sm z-10">
                                        <tr>
                                            <th className="px-6 py-4">Nome</th>
                                            <th className="px-6 py-4">Telefone / WhatsApp</th>
                                            <th className="px-6 py-4">Empresa</th>
                                            <th className="px-6 py-4 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredLeads.map(lead => (
                                            <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4 font-bold text-slate-900">{lead.name}</td>
                                                <td className="px-6 py-4 font-mono text-sm text-slate-600">{lead.phone ? lead.phone.replace(/whatsapp/ig, '').trim() : '-'}</td>
                                                <td className="px-6 py-4 text-slate-500 text-sm">{lead.company || '-'}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleDeleteLead(lead.id)}
                                                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <Modal isOpen={activeModal === 'new-folder'} onClose={() => setActiveModal('none')} title="Nova Pasta de Leads">
                <form onSubmit={handleCreateFolder} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Nome da Pasta</label>
                        <input
                            type="text"
                            placeholder="Ex: Audiência Fria, Clientes Antigos..."
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all"
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => setActiveModal('none')} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg transition-colors">Cancelar</button>
                        <button type="submit" disabled={modalLoading} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 flex items-center gap-2">
                            {modalLoading && <Loader2 size={16} className="animate-spin" />} Criar Pasta
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={activeModal === 'new-lead'} onClose={() => setActiveModal('none')} title="Cadastrar Novo Lead">
                <form onSubmit={handleCreateLead} className="space-y-4">
                    <div className="space-y-4">
                        <input placeholder="Nome do Lead *" required value={newLeadForm.name} onChange={e => setNewLeadForm({ ...newLeadForm, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                        <input placeholder="Telefone / WhatsApp *" required value={newLeadForm.phone} onChange={e => setNewLeadForm({ ...newLeadForm, phone: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                        <input placeholder="Empresa (Opcional)" value={newLeadForm.company} onChange={e => setNewLeadForm({ ...newLeadForm, company: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                        <button type="submit" disabled={modalLoading} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 flex justify-center items-center gap-2">
                            {modalLoading && <Loader2 size={16} className="animate-spin" />} Salvar Lead
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={activeModal === 'import-leads'} onClose={() => setActiveModal('none')} title="Importação em Massa">
                <form onSubmit={handleImportLeads} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Cole a sua lista de contatos</label>
                        <p className="text-xs text-slate-500 mb-2">Formato esperado: Nome ou Razão - Telefone</p>
                        <textarea
                            placeholder="Lucas Renato - 43999572256&#10;Maria Silva - 11988887777"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all text-sm font-mono h-48 resize-none"
                            value={importText}
                            onChange={e => setImportText(e.target.value)}
                            required
                        />
                    </div>
                    <div className="pt-4 space-y-3">
                        <button type="submit" disabled={modalLoading} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 flex justify-center items-center gap-2">
                            {modalLoading && <Loader2 size={16} className="animate-spin" />} Iniciar Importação
                        </button>
                        <button type="button" onClick={() => setActiveModal('none')} className="w-full py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                    </div>
                </form>
            </Modal>

        </div>
    );
};
