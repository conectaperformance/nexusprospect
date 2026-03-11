import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    Key,
    Copy,
    CheckCircle2,
    Loader2,
    ShieldCheck,
    AlertCircle,
    Lock
} from 'lucide-react';

const generateAccessKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 12; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `NEXUS360-${randomPart}`;
};

const AccessKeyTab: React.FC = () => {
    const { user } = useAuth();
    const [accessKey, setAccessKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) fetchAccessKey();
    }, [user]);

    const fetchAccessKey = async () => {
        try {
            setLoading(true);
            
            // 1. Fetch access key
            const { data: keyData, error: keyError } = await supabase
                .rpc('get_access_key', { p_user_id: user!.id });

            if (keyError) throw keyError;
            setAccessKey(keyData || null);

        } catch (err: any) {
            console.error('Erro ao buscar a chave de acesso:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!user || accessKey) return;

        try {
            setGenerating(true);
            setError(null);

            const newKey = generateAccessKey();

            // Salvar no Supabase via RPC
            const { error: dbError } = await supabase
                .rpc('set_access_key', { p_user_id: user.id, p_key: newKey });

            if (dbError) throw dbError;

            // Enviar para o webhook externo
            try {
                await fetch('https://nexus360.infra-conectamarketing.site/webhook/5c008e53-e240-4905-98df-abdf1c15bdrrth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'access_key_generated',
                        accessKey: newKey,
                        userId: user.id,
                        email: user.email,
                        name: user.user_metadata?.full_name || 'N/A',
                        timestamp: new Date().toISOString()
                    })
                });
            } catch (webhookError) {
                console.error('Erro ao enviar chave para o webhook externo:', webhookError);
            }

            setAccessKey(newKey);
        } catch (err: any) {
            console.error('Erro ao gerar a chave de acesso:', err);
            setError(err?.message || 'Não foi possível gerar a chave. Tente novamente.');
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = async () => {
        if (!accessKey) return;
        try {
            await navigator.clipboard.writeText(accessKey);
            showCopiedState();
        } catch {
            const input = document.createElement('input');
            input.value = accessKey;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            showCopiedState();
        }
    };

    const showCopiedState = () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
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
                    <Key className="text-slate-700" size={22} />
                    Chave de Acesso
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Gere e gerencie a sua Chave de Acesso única (licença de uso) com segurança.
                </p>
            </div>

            {/* Access Key Card */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200 p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-slate-900 text-white rounded-xl">
                            <Lock size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Licença de Uso Exclusiva</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Essa chave identifica o seu usuário nas plataformas integradas à rede.
                            </p>
                        </div>
                    </div>
                </div>

                {accessKey ? (
                    /* Key exists - show it */
                    <div className="space-y-4">
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                            <div className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 font-mono text-sm font-black text-slate-800 tracking-[0.2em] truncate cursor-text select-all text-center md:text-left">
                                {accessKey}
                            </div>
                            <button
                                type="button"
                                onClick={copyToClipboard}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${copied
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-900 text-white hover:bg-slate-800'
                                    }`}
                            >
                                {copied ? (
                                    <>
                                        <CheckCircle2 size={16} />
                                        Copiada!
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
                            <span className="font-bold">Chave de acesso ativa, inalterável e vinculada ao perfil.</span>
                        </div>
                    </div>
                ) : (
                    /* No key - show generate button */
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                            <AlertCircle size={14} />
                            <span className="font-bold">Nenhuma chave de licença encontrada para a sua conta. Gere agora.</span>
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
                                    Gerando acesso único...
                                </>
                            ) : (
                                <>
                                    <Key size={16} />
                                    Gerar Chave Única de Utilização
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
                <h4 className="text-sm font-bold text-slate-800 mb-3">Como funciona a Chave de Acesso?</h4>
                <ol className="text-xs text-slate-500 space-y-2 list-decimal list-inside">
                    <li>Gere sua licença clicando no botão assinalado acima. Ela é gerada apenas <strong>uma única vez</strong>.</li>
                    <li>Sua licença obedece o formato oficial <strong className="text-slate-700 tracking-wider">NEXUS360-XYZ...</strong> padrão.</li>
                    <li>Forneça essa chave quando o suporte ou uma ferramenta externa pedir a identificação do seu ambiente.</li>
                    <li>Nunca será necessário regenerá-la; cada chave é permanente e não transfere para outros perfis validos.</li>
                </ol>

                <div className="mt-4 p-3 bg-red-50/50 rounded-xl border border-red-100">
                    <p className="text-[11px] text-red-600 font-medium leading-relaxed">
                        🚨 <strong>Atenção:</strong> Jamais compartilhe abertamente essa chave de acesso em ambientes não-seguros. Essa licença única reflete os dados sigilosos e limites operacionais reservados à sua conta no sistema. Ela não pode ser deletada ou editada depois de gerada.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AccessKeyTab;
