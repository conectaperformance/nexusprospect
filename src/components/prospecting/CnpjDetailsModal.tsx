import React, { useMemo } from 'react';
import { X, Printer, ExternalLink } from 'lucide-react';

interface CnpjLead {
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
    search_term: string | null; // Contains the raw JSON payload
    created_at: string;
}

interface CnpjDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: CnpjLead | null;
}

const CnpjDetailsModal: React.FC<CnpjDetailsModalProps> = ({ isOpen, onClose, lead }) => {
    if (!isOpen || !lead) return null;

    // Parse the raw payload from search_term to extract all rich fields
    const details = useMemo(() => {
        let parsed: any = {};
        if (lead.search_term && lead.search_term.trim().startsWith('{')) {
            try {
                parsed = JSON.parse(lead.search_term);
            } catch (e) {
                console.warn("Failed to parse search_term:", e);
            }
        }
        return parsed;
    }, [lead.search_term]);

    // Format helpers
    const getValue = (keys: string[], fallback: any = '') => {
        for (const key of keys) {
            if (details[key] !== undefined && details[key] !== null) return details[key];
        }
        return fallback;
    };

    const cnpj = getValue(['CNPJ', 'cnpj'], 'Não informado');
    const abertura = getValue(['ABERTURA', 'DATA_ABERTURA', 'data_abertura'], 'Não informada');
    const nomeEmpresarial = getValue(['RAZAO_SOCIAL', 'razao_social', 'nome_empresa', 'NOME_EMPRESA'], lead.company || lead.name || 'Não informado');
    const nomeFantasia = getValue(['FANTASIA', 'nome_fantasia', 'NOME_FANTASIA'], lead.name || 'Não informado');
    const porte = getValue(['PORTE', 'porte'], '');
    const cnaePrincipal = getValue(['CNAE_PRINCIPAL', 'cnae_principal_descricao', 'atividade_principal'], lead.specialties || 'Não informado');
    const cnaesSecundarios = getValue(['CNAES_SECUNDARIOS', 'cnaes_secundarios'], []);
    const naturezaJuridica = getValue(['NATUREZA_JURIDICA', 'natureza_juridica'], 'Não informada');
    const logradouro = getValue(['LOGRADOURO', 'logradouro', 'endereco', 'address'], lead.address || 'Não informado');
    const numero = getValue(['NUMERO', 'numero'], 'S/N');
    const complemento = getValue(['COMPLEMENTO', 'complemento'], '');
    const cep = getValue(['CEP', 'cep'], 'Não informado');
    const bairro = getValue(['BAIRRO', 'bairro', 'distrito'], 'Não informado');
    const municipio = getValue(['MUNICIPIO', 'municipio', 'cidade'], 'Não informado');
    const uf = getValue(['UF', 'uf', 'estado'], 'Não informado');
    const email = getValue(['EMAIL', 'email'], 'Não informado');
    const telefone = getValue(['TELEFONE', 'telefone', 'celular', 'phone'], lead.phone || 'Não informado').replace(/whatsapp/ig, '').trim();
    const efr = getValue(['ENTE_FEDERATIVO', 'efr'], '*****');
    const situacaoCadastral = getValue(['SITUACAO', 'situacao_cadastral', 'status'], 'ATIVA');
    const dataSituacao = getValue(['DATA_SITUACAO', 'data_situacao_cadastral'], abertura); // Fallback to abertura if not found
    const motivoSituacao = getValue(['MOTIVO_SITUACAO', 'motivo_situacao'], '');
    const situacaoEspecial = getValue(['SITUACAO_ESPECIAL', 'situacao_especial'], '********');
    const dataSituacaoEspecial = getValue(['DATA_SITUACAO_ESPECIAL', 'data_situacao_especial'], '********');

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 print:p-0 print:items-start" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            {/* Overlay */}
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity print:hidden" onClick={onClose}></div>

            {/* Modal Panel */}
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col transform transition-all print:rounded-none print:shadow-none print:max-w-none print:max-h-none print:overflow-visible">
                
                {/* Header Actions (No print) */}
                <div className="sticky top-0 bg-white/95 backdrop-blur z-10 flex items-center justify-between p-4 border-b border-slate-200 print:hidden">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition-colors"
                        >
                            <Printer size={16} />
                            Imprimir
                        </button>
                        <a 
                            href={`https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 font-semibold rounded-lg text-sm transition-colors"
                        >
                            <ExternalLink size={16} />
                            Consultar na Receita
                        </a>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* RFB Document Body */}
                <div className="p-6 md:p-10 font-sans text-black print:p-0" id="rfb-document">
                    
                    {/* Brasão e Cabeçalho */}
                    <div className="flex flex-col items-center mb-6 text-center">
                        <img 
                            src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Coat_of_arms_of_Brazil.svg/200px-Coat_of_arms_of_Brazil.svg.png" 
                            alt="Brasão da República" 
                            className="w-16 h-16 mb-4 grayscale contrast-125"
                        />
                        <h1 className="text-xl font-bold uppercase tracking-tight m-0">República Federativa do Brasil</h1>
                        <h2 className="text-lg font-bold uppercase mt-2">Cadastro Nacional da Pessoa Jurídica</h2>
                    </div>

                    {/* Formulário Boxed View */}
                    <div className="border-[2px] border-black text-[11px] leading-snug sm:text-xs">
                        
                        {/* Linha 1 */}
                        <div className="flex border-b-[1px] border-black">
                            <div className="w-1/4 min-w-[140px] border-r-[1px] border-black p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Número de Inscrição</span>
                                <span className="block font-bold mt-1 text-sm">{cnpj}</span>
                                <span className="block font-bold">MATRIZ</span>
                            </div>
                            <div className="flex-1 w-2/4 border-r-[1px] border-black p-1 flex items-center justify-center text-center">
                                <span className="font-bold text-base uppercase">Comprovante de Inscrição e de Situação Cadastral</span>
                            </div>
                            <div className="w-1/4 p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Data de Abertura</span>
                                <span className="block font-bold mt-1">{abertura}</span>
                            </div>
                        </div>

                        {/* Linha 2 */}
                        <div className="border-b-[1px] border-black p-1">
                            <span className="block text-[9px] uppercase font-bold text-gray-700">Nome Empresarial</span>
                            <span className="block font-bold mt-0.5 uppercase">{nomeEmpresarial}</span>
                        </div>

                        {/* Linha 3 */}
                        <div className="flex border-b-[1px] border-black">
                            <div className="w-4/5 border-r-[1px] border-black p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Título do Estabelecimento (Nome de Fantasia)</span>
                                <span className="block font-bold mt-0.5 uppercase mb-1">{nomeFantasia}</span>
                            </div>
                            <div className="w-1/5 p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Porte</span>
                                <span className="block font-bold mt-0.5">{porte}</span>
                            </div>
                        </div>

                        {/* Linha 4 */}
                        <div className="border-b-[1px] border-black p-1">
                            <span className="block text-[9px] uppercase font-bold text-gray-700">Código e Descrição da Atividade Econômica Principal</span>
                            <span className="block font-bold mt-0.5 uppercase">{cnaePrincipal}</span>
                        </div>

                        {/* Linha 5 */}
                        <div className="border-b-[1px] border-black p-1 min-h-[60px]">
                            <span className="block text-[9px] uppercase font-bold text-gray-700 mb-1">Código e Descrição das Atividades Econômicas Secundárias</span>
                            {cnaesSecundarios && Array.isArray(cnaesSecundarios) && cnaesSecundarios.length > 0 ? (
                                <ul className="list-none">
                                    {cnaesSecundarios.map((cnae, idx) => (
                                        <li key={idx} className="font-bold uppercase">{cnae}</li>
                                    ))}
                                </ul>
                            ) : (
                                <span className="block font-bold uppercase">Não informada</span>
                            )}
                        </div>

                        {/* Linha 6 */}
                        <div className="border-b-[1px] border-black p-1">
                            <span className="block text-[9px] uppercase font-bold text-gray-700">Código e Descrição da Natureza Jurídica</span>
                            <span className="block font-bold mt-0.5 uppercase">{naturezaJuridica}</span>
                        </div>

                        {/* Linha 7 (Logradouro, Numero, Complemento) */}
                        <div className="flex border-b-[1px] border-black">
                            <div className="w-3/5 border-r-[1px] border-black p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Logradouro</span>
                                <span className="block font-bold mt-0.5 uppercase mb-1">{logradouro}</span>
                            </div>
                            <div className="w-1/5 border-r-[1px] border-black p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Número</span>
                                <span className="block font-bold mt-0.5 uppercase mb-1">{numero}</span>
                            </div>
                            <div className="w-1/5 p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Complemento</span>
                                <span className="block font-bold mt-0.5 uppercase mb-1">{complemento || '********'}</span>
                            </div>
                        </div>

                        {/* Linha 8 (CEP, Bairro, Municipio, UF) */}
                        <div className="flex border-b-[1px] border-black">
                            <div className="w-1/4 border-r-[1px] border-black p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">CEP</span>
                                <span className="block font-bold mt-0.5 uppercase mb-1">{cep}</span>
                            </div>
                            <div className="w-1/4 border-r-[1px] border-black p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Bairro/Distrito</span>
                                <span className="block font-bold mt-0.5 uppercase mb-1">{bairro}</span>
                            </div>
                            <div className="w-2/4 border-r-[1px] border-black p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Município</span>
                                <span className="block font-bold mt-0.5 uppercase mb-1">{municipio}</span>
                            </div>
                            <div className="w-12 p-1 shrink-0">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">UF</span>
                                <span className="block font-bold mt-0.5 uppercase mb-1">{uf}</span>
                            </div>
                        </div>

                        {/* Linha 9 (Email, Telefone) */}
                        <div className="flex border-b-[1px] border-black">
                            <div className="w-3/5 border-r-[1px] border-black p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Endereço Eletrônico</span>
                                <span className="block font-bold mt-0.5 uppercase mb-1">{email}</span>
                            </div>
                            <div className="w-2/5 p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Telefone</span>
                                <span className="block font-bold mt-0.5 uppercase mb-1">{telefone}</span>
                            </div>
                        </div>

                        {/* Linha 10 */}
                        <div className="border-b-[1px] border-black p-1">
                            <span className="block text-[9px] uppercase font-bold text-gray-700">Ente Federativo Responsável (EFR)</span>
                            <span className="block font-bold mt-0.5 uppercase mb-1">{efr}</span>
                        </div>

                        {/* Linha 11 (Situacao Cadastral) */}
                        <div className="flex border-b-[1px] border-black">
                            <div className="w-3/4 border-r-[1px] border-black p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Situação Cadastral</span>
                                <span className="block font-bold mt-0.5 uppercase mb-1">{situacaoCadastral}</span>
                            </div>
                            <div className="w-1/4 p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Data da Situação Cadastral</span>
                                <span className="block font-bold mt-0.5">{dataSituacao}</span>
                            </div>
                        </div>

                        {/* Linha 12 */}
                        <div className="border-b-[1px] border-black p-1 min-h-[40px]">
                            <span className="block text-[9px] uppercase font-bold text-gray-700">Motivo de Situação Cadastral</span>
                            <span className="block font-bold mt-0.5 uppercase">{motivoSituacao}</span>
                        </div>

                        {/* Linha 13 */}
                        <div className="flex">
                            <div className="w-3/4 border-r-[1px] border-black p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Situação Especial</span>
                                <span className="block font-bold mt-0.5 uppercase mb-1">{situacaoEspecial}</span>
                            </div>
                            <div className="w-1/4 p-1">
                                <span className="block text-[9px] uppercase font-bold text-gray-700">Data da Situação Especial</span>
                                <span className="block font-bold mt-0.5">{dataSituacaoEspecial}</span>
                            </div>
                        </div>

                    </div>
                    {/* End Form Box */}

                    <div className="mt-8 text-center text-[10px] text-gray-600 print:mt-4">
                        <p>Aprovado pela Instrução Normativa RFB nº 2.119, de 06 de dezembro de 2022.</p>
                        <p>Documento gerado como visualização auxiliar de metadados extraídos pelo CDD.</p>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default CnpjDetailsModal;
