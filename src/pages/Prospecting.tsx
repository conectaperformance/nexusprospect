import React, { useState } from 'react';
import { Target, Send, MapPin, Instagram, Building2, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { WhatsAppCampaignForm } from '../components/prospecting/WhatsAppCampaignForm';
import GoogleMapsLeadSearch from '../components/prospecting/GoogleMapsLeadSearch';
import InstagramLeadSearch from '../components/prospecting/InstagramLeadSearch';
import CnpjLeadSearch from '../components/prospecting/CnpjLeadSearch';

const Prospecting: React.FC = () => {
    const { user } = useAuth();
    const isGlobalAdmin = user?.email === 'marketing@conectaperformance.com.br';

    const [activeTab, setActiveTab] = useState<'messages' | 'maps' | 'instagram' | 'cnpj'>('messages');

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => {
        const isLocked = false;

        return (
            <button
                type="button"
                onClick={() => {
                    if (isLocked) return;
                    setActiveTab(id);
                }}
                className={`relative flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 lg:px-4 lg:py-3 rounded-xl transition-all duration-300 font-bold text-xs lg:text-sm ${isLocked
                    ? 'cursor-not-allowed text-slate-400 bg-slate-50 opacity-90'
                    : activeTab === id
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
            >
                <Icon size={16} className={activeTab === id && !isLocked ? 'text-brand-400' : ''} />
                <span className="whitespace-nowrap">{label}</span>
                {isLocked && (
                    <div className="flex items-center gap-1 ml-0.5 bg-slate-200/50 p-1.5 rounded-md text-red-400">
                        <Lock size={12} strokeWidth={2.5} />
                    </div>
                )}
            </button>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header - Premium Dark Hero */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 text-white p-8 rounded-3xl overflow-hidden relative shadow-2xl shadow-slate-900/10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400 rounded-full blur-[100px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 text-center md:text-left">
                    <h1 className="text-3xl font-black mb-2 tracking-tight flex items-center justify-center md:justify-start gap-3">
                        <Target className="text-yellow-500" size={32} />
                        Prospecção de Leads
                    </h1>
                    <p className="text-slate-300 font-medium w-full">
                        Construa a sua máquina de prospecção multicanal: Encontre, engaje e converta em piloto automático.
                    </p>
                </div>
            </div>

            {/* Tabs Nav - Premium Pills */}
            <div className="flex p-1 bg-white border border-slate-200 rounded-2xl w-full shadow-sm overflow-x-auto hide-scrollbar">
                <TabButton id="messages" label="Disparo no WhatsApp" icon={Send} />
                <TabButton id="maps" label="Leads no Google Maps" icon={MapPin} />
                <TabButton id="instagram" label="Leads no Instagram" icon={Instagram} />
                <TabButton id="cnpj" label="Leads por CNPJ" icon={Building2} />
            </div>

            <div className="pt-6">
                {activeTab === 'messages' && (
                    <WhatsAppCampaignForm />
                )}



                {activeTab === 'maps' && (
                    <GoogleMapsLeadSearch />
                )}

                {activeTab === 'instagram' && (
                    <InstagramLeadSearch />
                )}

                {activeTab === 'cnpj' && (
                    <CnpjLeadSearch />
                )}
            </div>
        </div>
    );
};

export default Prospecting;
