import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    Webhook,
    Copy,
    CheckCircle2,
    Loader2,
    Key,
    ShieldCheck,
    AlertCircle,
} from 'lucide-react';

const generateWebhookKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'NEXUS-';
    for (let i = 0; i < 9; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const WebhookTab: React.FC = () => {
    const { user } = useAuth();
    const [webhookKey, setWebhookKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) fetchWebhookKey();
    }, [user]);

    const fetchWebhookKey = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .rpc('get_webhook_key', { p_user_id: user!.id });

            if (error) throw error;
            setWebhookKey(data || null);
        } catch (err: any) {
            console.error('Erro ao buscar webhook key:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!user || webhookKey) return;

        try {
            setGenerating(true);
            setError(null);

            const newKey = generateWebhookKey();

            // 1. Salvar no Supabase via RPC (bypassa RLS)
            const { error: dbError } = await supabase
                .rpc('set_webhook_key', { p_user_id: user.id, p_key: newKey });

            if (dbError) throw dbError;

            // 2. Notificar o n8n
            try {
                await fetch('https://nexus360.infra-conectamarketing.site/webhook/5c008e53-e240-4905-98df-abdf1c15bdrrth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user.id,
                        email: user.email,
                        webhookKey: newKey,
                        action: 'webhook_key_created',
                    }),
                });
            } catch (webhookErr) {
                console.warn('Aviso: não foi possível notificar o n8n:', webhookErr);
            }

            setWebhookKey(newKey);
        } catch (err: any) {
            console.error('Erro ao gerar webhook key:', err);
            setError(err?.message || 'Não foi possível gerar a chave. Tente novamente.');
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = async () => {
        if (!webhookKey) return;
        try {
            await navigator.clipboard.writeText(webhookKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            // Fallback
            const input = document.createElement('input');
            input.value = webhookKey;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
                    <Webhook className="text-slate-700" size={22} />
                    Webhook
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Gerencie sua chave de webhook única para integração com ferramentas externas.
                </p>
            </div>

            {/* Webhook Key Card */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200 p-6 md:p-8">
                <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 bg-slate-900 text-white rounded-xl">
                        <Key size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900">Chave de Webhook</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Esta chave é única e permanente. Ela identifica sua conta em integrações externas.
                        </p>
                    </div>
                </div>

                {webhookKey ? (
                    /* Key exists - show it */
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 font-mono text-sm font-bold text-slate-800 tracking-wider select-all">
                                {webhookKey}
                            </div>
                            <button
                                type="button"
                                onClick={copyToClipboard}
                                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${copied
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-900 text-white hover:bg-slate-800'
                                    }`}
                            >
                                {copied ? (
                                    <>
                                        <CheckCircle2 size={16} />
                                        Copiado!
                                    </>
                                ) : (
                                    <>
                                        <Copy size={16} />
                                        Copiar
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                            <ShieldCheck size={14} />
                            <span className="font-bold">Chave ativa e pronta para uso.</span>
                        </div>
                    </div>
                ) : (
                    /* No key - show generate button */
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                            <AlertCircle size={14} />
                            <span className="font-bold">Nenhuma chave gerada ainda. Clique no botão abaixo para criar.</span>
                        </div>

                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={generating}
                            className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-900/20"
                        >
                            {generating ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Gerando chave...
                                </>
                            ) : (
                                <>
                                    <Key size={16} />
                                    Gerar Chave de Webhook
                                </>
                            )}
                        </button>

                        {error && (
                            <p className="text-xs text-red-500 font-bold">{error}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Info Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h4 className="text-sm font-bold text-slate-800 mb-3">Como funciona?</h4>
                <ol className="text-xs text-slate-500 space-y-2 list-decimal list-inside">
                    <li>Gere sua <strong>chave de webhook única</strong> clicando no botão acima.</li>
                    <li>Configure a chave na sua <strong>extensão do navegador</strong> (Opera/Chrome).</li>
                    <li>A extensão usará essa chave para <strong>enviar os leads extraídos</strong> diretamente para o Nexus360.</li>
                    <li>Os leads chegarão automaticamente na aba <strong>"Leads no Google Maps"</strong> da Prospecção.</li>
                </ol>

                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[11px] text-slate-400">
                        ⚠️ <strong>Importante:</strong> Não compartilhe sua chave de webhook com terceiros. Ela identifica unicamente a sua conta no sistema.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default WebhookTab;
