import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bot, Save, Loader2, AlertTriangle, CheckCircle2, Send, MessageCircle, RefreshCw, Lock } from 'lucide-react';

type AgentType = 'dispatch' | 'support' | 'followup';

interface AgentSettings {
    id?: string;
    is_active: boolean;
    agent_name: string;
    use_custom_initial_message: boolean;
    initial_message: string;
    language: string;
    temperature: number;
    provider: string;
    model: string;
    prompt_dispatch: string;
    prompt_support: string;
    prompt_followup: string;
}

const AGENT_TYPES: { id: AgentType; label: string; description: string; icon: React.ElementType }[] = [
    { id: 'dispatch', label: 'Agente de Disparo', description: 'Personalize o agente para campanhas de envio de mensagens.', icon: Send },
    { id: 'support', label: 'Agente de Atendimento', description: 'Personalize o agente para atendimento ao cliente via WhatsApp.', icon: MessageCircle },
    { id: 'followup', label: 'Agente de Follow-up', description: 'Personalize o agente para acompanhamento pós-contato.', icon: RefreshCw },
];

const PROMPT_COLUMN: Record<AgentType, keyof AgentSettings> = {
    dispatch: 'prompt_dispatch',
    support: 'prompt_support',
    followup: 'prompt_followup',
};

const defaultSettings: AgentSettings = {
    is_active: false,
    agent_name: '',
    use_custom_initial_message: false,
    initial_message: '',
    language: 'pt-BR',
    temperature: 0.7,
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    prompt_dispatch: '',
    prompt_support: '',
    prompt_followup: '',
};

const AiAgents: React.FC = () => {
    const { user, isStarter } = useAuth();
    const [selectedAgentType, setSelectedAgentType] = useState<AgentType | ''>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [settings, setSettings] = useState<AgentSettings>({ ...defaultSettings });

    useEffect(() => {
        if (user) fetchSettings();
    }, [user]);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('ai_agent_settings')
                .select('*')
                .eq('user_id', user!.id)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                setSettings({
                    id: data.id,
                    is_active: data.is_active || false,
                    agent_name: data.agent_name || '',
                    use_custom_initial_message: data.use_custom_initial_message || false,
                    initial_message: data.initial_message || '',
                    language: data.language || 'pt-BR',
                    temperature: data.temperature ?? 0.7,
                    provider: data.provider || 'openai',
                    model: data.model || 'gpt-3.5-turbo',
                    prompt_dispatch: data.prompt_dispatch || '',
                    prompt_support: data.prompt_support || '',
                    prompt_followup: data.prompt_followup || '',
                });
            }
        } catch (err: any) {
            console.error('Error fetching agent settings:', err);
            setMessage({ type: 'error', text: 'Não foi possível carregar as configurações do agente.' });
        } finally {
            setLoading(false);
        }
    };

    const currentPromptKey = selectedAgentType ? PROMPT_COLUMN[selectedAgentType] : null;
    const currentPromptValue = currentPromptKey ? (settings[currentPromptKey] as string) : '';

    const updatePrompt = (value: string) => {
        if (!currentPromptKey) return;
        setSettings(prev => ({ ...prev, [currentPromptKey]: value }));
    };

    const handleSave = async () => {
        if (!user || !selectedAgentType) return;

        try {
            setSaving(true);
            setMessage(null);

            const payload = {
                is_active: settings.is_active,
                agent_name: settings.agent_name,
                use_custom_initial_message: settings.use_custom_initial_message,
                initial_message: settings.use_custom_initial_message ? settings.initial_message : '',
                language: settings.language,
                temperature: settings.temperature,
                provider: settings.provider,
                model: settings.model,
                prompt_dispatch: settings.prompt_dispatch,
                prompt_support: settings.prompt_support,
                prompt_followup: settings.prompt_followup,
                updated_at: new Date().toISOString(),
            };

            let query;
            if (settings.id) {
                query = supabase
                    .from('ai_agent_settings')
                    .update(payload)
                    .eq('id', settings.id);
            } else {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('organization_id')
                    .eq('id', user.id)
                    .single();

                query = supabase
                    .from('ai_agent_settings')
                    .insert({
                        ...payload,
                        organization_id: profile?.organization_id || null,
                        user_id: user.id,
                    });
            }

            const { error } = await query;
            if (error) throw error;

            // Se for Agente de Atendimento, notificar o webhook do N8N com todas as instâncias
            if (selectedAgentType === 'support') {
                try {
                    // Buscar todas as instâncias conectadas do usuário
                    const { data: connections } = await supabase
                        .from('whatsapp_connections')
                        .select('instance, token, phone_number, profile_name, status')
                        .eq('user_id', user.id);

                    const allInstances = (connections || []).map(conn => ({
                        instance: conn.instance,
                        token: conn.token,
                        phoneNumber: conn.phone_number,
                        profileName: conn.profile_name,
                        status: conn.status,
                    }));

                    await fetch('https://nexus360.infra-conectamarketing.site/webhook/e30ccb57-e8ed-49a4-8915-4617d43e3724', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: user.id,
                            agentType: 'support',
                            is_active: settings.is_active,
                            agent_name: settings.agent_name,
                            prompt: settings.prompt_support,
                            language: settings.language,
                            instances: allInstances,
                            instanceCount: allInstances.length,
                        }),
                    });
                } catch (webhookErr) {
                    console.warn('Webhook do agente de atendimento não respondeu:', webhookErr);
                }
            }

            setMessage({ type: 'success', text: 'Configurações do agente salvas com sucesso!' });
            setTimeout(() => setMessage(null), 3000);

            if (!settings.id) fetchSettings();

        } catch (err: any) {
            console.error('Error saving agent settings:', err);
            setMessage({ type: 'error', text: `Erro ao salvar: ${err.message}` });
        } finally {
            setSaving(false);
        }
    };

    const currentAgentLabel = AGENT_TYPES.find(a => a.id === selectedAgentType)?.label || 'Agente';

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 size={32} className="animate-spin text-[#ffd700]" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in slide-in-from-right-2 duration-300 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 text-white p-8 rounded-3xl overflow-hidden relative shadow-2xl shadow-slate-900/10 mb-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400 rounded-full blur-[100px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 text-center md:text-left">
                    <h1 className="text-2xl md:text-3xl font-black mb-2 tracking-tight flex flex-col md:flex-row items-center justify-center md:justify-start gap-3">
                        <Bot className="text-yellow-500" size={32} />
                        Agentes de IA
                    </h1>
                    <p className="text-slate-300 font-medium text-sm md:text-base">
                        Selecione e personalize os agentes inteligentes da sua empresa.
                    </p>
                </div>
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-3xl p-8 md:p-10 shadow-sm border border-slate-200">
                <div className="mb-8">
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <Bot className="text-brand-500" size={28} />
                        Configuração do Agente
                    </h2>
                    <p className="text-slate-500 mt-2 font-medium">
                        Selecione o tipo de agente que deseja personalizar e configure seu comportamento.
                    </p>
                </div>

                {/* Agent Type Selector */}
                <div className="mb-10">
                    <label className="block text-sm font-bold text-slate-700 mb-4">Selecione o Agente *</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {AGENT_TYPES.map(({ id, label, description, icon: Icon }) => {
                            const isLocked = isStarter && id === 'followup';

                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => {
                                        if (isLocked) return;
                                        setSelectedAgentType(selectedAgentType === id ? '' : id);
                                    }}
                                    className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 ${isLocked ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-70' : selectedAgentType === id
                                        ? 'border-slate-900 bg-slate-900 shadow-xl transform -translate-y-1'
                                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                >
                                    {isLocked && (
                                        <div className="absolute top-3 right-3 bg-red-100 text-red-600 p-1.5 rounded-lg flex items-center justify-center shadow-sm">
                                            <Lock size={14} />
                                        </div>
                                    )}
                                    <Icon className={`mb-3 ${isLocked ? 'text-slate-300' : selectedAgentType === id ? 'text-yellow-500' : 'text-slate-400'}`} size={32} />
                                    <span className={`font-bold ${isLocked ? 'text-slate-400' : selectedAgentType === id ? 'text-white' : 'text-slate-700'}`}>{label}</span>
                                    <span className={`text-xs text-center mt-2 ${isLocked ? 'text-slate-400' : selectedAgentType === id ? 'text-slate-300' : 'text-slate-500'}`}>{description}</span>
                                    {isLocked && (
                                        <div className="mt-4 bg-slate-200 text-slate-500 text-[10px] uppercase tracking-wider font-bold py-1 px-3 rounded-full">
                                            Plano Pro
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Form — only shown when an agent type is selected */}
                {selectedAgentType && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        {/* Active toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div>
                                <p className="text-sm font-bold text-slate-800">{currentAgentLabel}</p>
                                <p className="text-xs text-slate-500">Ative ou desative este agente</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-sm font-bold ${settings.is_active ? 'text-emerald-500' : 'text-slate-400'}`}>
                                    {settings.is_active ? 'Ativado' : 'Desativado'}
                                </span>
                                <button
                                    onClick={() => setSettings({ ...settings, is_active: !settings.is_active })}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none ${settings.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                >
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${settings.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>

                        {/* Basic Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Nome do Agente</label>
                                <input
                                    type="text"
                                    value={settings.agent_name}
                                    onChange={(e) => setSettings({ ...settings, agent_name: e.target.value })}
                                    placeholder="Ex: Assistente Conecta"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700] focus:bg-white transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Idioma do Agente</label>
                                <select
                                    value={settings.language}
                                    onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700] focus:bg-white transition-all"
                                >
                                    <option value="pt-BR">Português (Brasil)</option>
                                    <option value="en-US">English (US)</option>
                                    <option value="es-ES">Español</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-bold text-slate-700">Mensagem Inicial Padrão</label>
                                <p className="text-xs text-slate-500 mt-1 mb-3">Define como o agente iniciará o atendimento com o cliente.</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <label className={`flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all min-h-[80px] ${!settings.use_custom_initial_message ? 'border-[#ffd700] bg-[#ffd700]/5' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                                        <input
                                            type="radio"
                                            name="initialMsgType"
                                            checked={!settings.use_custom_initial_message}
                                            onChange={() => setSettings({ ...settings, use_custom_initial_message: false })}
                                            className="w-4 h-4 text-[#ffd700] focus:ring-[#ffd700] border-slate-300 shrink-0"
                                        />
                                        <div className="ml-3">
                                            <span className="block text-sm font-bold text-slate-900">Deixar o Agente decidir</span>
                                            <span className="block text-xs text-slate-500 mt-1">A IA vai gerar a mensagem inicial com base no prompt.</span>
                                        </div>
                                    </label>

                                    <label className={`flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all min-h-[80px] ${settings.use_custom_initial_message ? 'border-[#ffd700] bg-[#ffd700]/5' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                                        <input
                                            type="radio"
                                            name="initialMsgType"
                                            checked={settings.use_custom_initial_message}
                                            onChange={() => setSettings({ ...settings, use_custom_initial_message: true })}
                                            className="w-4 h-4 text-[#ffd700] focus:ring-[#ffd700] border-slate-300 shrink-0"
                                        />
                                        <div className="ml-3">
                                            <span className="block text-sm font-bold text-slate-900">Mensagem fixa customizada</span>
                                            <span className="block text-xs text-slate-500 mt-1">O mesmo texto será enviado sempre no início.</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {settings.use_custom_initial_message && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <textarea
                                        value={settings.initial_message}
                                        onChange={(e) => setSettings({ ...settings, initial_message: e.target.value })}
                                        placeholder="Olá! Sou o assistente virtual. Como posso ajudar?"
                                        rows={2}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700] focus:bg-white transition-all resize-y"
                                    />
                                </div>
                            )}
                        </div>

                        <hr className="border-slate-100" />

                        {/* Prompt — uses the column specific to the selected agent type */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Prompt do {currentAgentLabel} (Diretrizes e Regras)</label>
                            <p className="text-xs text-slate-500 mb-2">Descreva detalhadamente como o agente deve se comportar, seu tom de voz, regras de negócio e informações importantes.</p>
                            <textarea
                                value={currentPromptValue}
                                onChange={(e) => updatePrompt(e.target.value)}
                                placeholder="Você é um assistente de vendas focado em conversão. Seu objetivo é..."
                                rows={10}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ffd700] focus:bg-white transition-all resize-y font-mono text-sm leading-relaxed"
                            />
                        </div>

                        {/* Notification */}
                        {message && (
                            <div className={`p-4 rounded-2xl border flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                {message.type === 'success' ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertTriangle size={20} className="text-red-500" />}
                                <span className="text-sm font-medium">{message.text}</span>
                            </div>
                        )}

                        {/* Submit */}
                        <div className="pt-6 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center space-x-2 px-8 py-4 bg-[#ffd700] text-slate-900 rounded-2xl font-black shadow-xl shadow-[#ffd700]/30 hover:bg-[#f8ab15] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                            >
                                {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                <span>Salvar Configurações</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiAgents;
