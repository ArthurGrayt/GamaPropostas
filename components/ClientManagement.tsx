import React, { useState, useEffect, useMemo } from 'react';
import { Client, Unit, EnrichedProposal, ProposalStatus } from '../types';
import { fetchCatalogData, getProposals, getProposalById } from '../services/mockData';
import { GlassCard, SearchBar, StatusBadge, FilterPill } from './UIComponents';
import { ArrowLeft, Search, FileText, ChevronDown, ChevronUp, X, Loader2, Calendar, DollarSign, Package, User, Building2 } from 'lucide-react';

interface Props {
    onBack: () => void;
}

type FilterStatus = 'ALL' | ProposalStatus;
type FilterFrequent = 'ALL' | 'FREQUENT' | 'NOT_FREQUENT';

export const ClientManagement: React.FC<Props> = ({ onBack }) => {
    const [units, setUnits] = useState<Unit[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [proposals, setProposals] = useState<EnrichedProposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
    const [frequentFilter, setFrequentFilter] = useState<FilterFrequent>('ALL'); // TODO: Determine how frequency applies to Units
    const [expandedUnitId, setExpandedUnitId] = useState<number | null>(null);
    const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);
    const [fullProposalDetails, setFullProposalDetails] = useState<EnrichedProposal | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const [catalogData, proposalsData] = await Promise.all([
                fetchCatalogData(),
                getProposals()
            ]);
            setUnits(catalogData.unidades);
            setClients(catalogData.clientes);
            setProposals(proposalsData);
            setLoading(false);
        };
        loadData();
    }, []);

    const filteredUnits = useMemo(() => {
        let result = units.map(u => {
            const client = clients.find(c => String(c.id) === String(u.empresaid));
            return { ...u, clientName: client?.nome_fantasia || client?.nome || 'Desconhecido', textSearch: `${u.nome_unidade} ${client?.nome_fantasia || ''} ${client?.nome || ''}`.toLowerCase() };
        });

        // 1. Text Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(u => u.textSearch.includes(query));
        }

        // 2. Status Filter
        if (statusFilter !== 'ALL') {
            result = result.filter(unit => {
                const unitProposals = proposals.filter(p => p.unidade_id === unit.id);
                return unitProposals.some(p => p.status === statusFilter);
            });
        }

        return result;
    }, [units, clients, searchQuery, statusFilter, proposals]);

    const handleProposalClick = async (proposalId: number) => {
        setSelectedProposalId(proposalId);
        setLoadingDetails(true);
        const details = await getProposalById(proposalId);
        setFullProposalDetails(details || null);
        setLoadingDetails(false);
    };

    const getProposalStatusLabel = (status: ProposalStatus) => {
        switch (status) {
            case 'APPROVED': return 'Aprovada';
            case 'REJECTED': return 'Reprovada';
            case 'PENDING': return 'Pendente';
            case 'ARCHIVED': return 'Arquivada';
            default: return status;
        }
    };

    const getProposalIdColor = (status: ProposalStatus) => {
        switch (status) {
            case 'APPROVED': return 'text-emerald-500';
            case 'REJECTED': return 'text-rose-500';
            case 'PENDING': return 'text-amber-500';
            default: return 'text-zinc-500';
        }
    };

    const getProposalStatusBadge = (status: ProposalStatus) => {
        switch (status) {
            case 'APPROVED': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400';
            case 'REJECTED': return 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400';
            case 'PENDING': return 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400';
            default: return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#050505] animate-fade-in pb-20 font-sans">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-[#F8FAFC]/90 dark:bg-[#050505]/90 backdrop-blur-xl px-6 pt-8 pb-4">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 md:items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:scale-105 active:scale-95 transition-all shadow-sm border border-zinc-100 dark:border-zinc-700"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                                Gerenciar Unidades
                            </h1>
                            <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-bold border border-zinc-200 dark:border-zinc-700">
                                {units.length}
                            </span>
                        </div>
                    </div>

                </div>

                {/* Filters */}
                <div className="max-w-6xl mx-auto mt-8 flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    <span className="text-[10px] font-extrabold text-zinc-400/80 uppercase tracking-widest whitespace-nowrap">PROPOSTAS:</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setStatusFilter('ALL')}
                            className={`px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${statusFilter === 'ALL' ? 'bg-[#118b89] text-white shadow-lg shadow-[#118b89]/20 scale-105' : 'text-zinc-500 hover:bg-white/50'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setStatusFilter('PENDING')}
                            className={`px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${statusFilter === 'PENDING' ? 'bg-[#118b89] text-white shadow-lg shadow-[#118b89]/20 scale-105' : 'text-zinc-500 hover:bg-white/50'}`}
                        >
                            Com Pendências
                        </button>
                        <button
                            onClick={() => setStatusFilter('APPROVED')}
                            className={`px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${statusFilter === 'APPROVED' ? 'bg-[#118b89] text-white shadow-lg shadow-[#118b89]/20 scale-105' : 'text-zinc-500 hover:bg-white/50'}`}
                        >
                            Aprovados
                        </button>
                        <button
                            onClick={() => setStatusFilter('REJECTED')}
                            className={`px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${statusFilter === 'REJECTED' ? 'bg-[#118b89] text-white shadow-lg shadow-[#118b89]/20 scale-105' : 'text-zinc-500 hover:bg-white/50'}`}
                        >
                            Reprovados
                        </button>
                    </div>

                    {/* Barra de Pesquisa Integrada nos Filtros */}
                    <div className="flex-1 max-w-xs ml-auto">
                        <div className="relative group">
                            {/* Ícone de busca posicionado dentro do input */}
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#118b89] transition-colors" size={16} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar..."
                                // Estilização para combinar com os filtros (pills)
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm focus:ring-2 focus:ring-[#118b89]/20 text-sm text-zinc-700 dark:text-zinc-200 font-medium placeholder:text-zinc-400 transition-all"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 mt-6 space-y-5">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                        <Loader2 className="w-8 h-8 animate-spin mb-2 text-[#118b89]" />
                        <p className="font-medium">Carregando unidades...</p>
                    </div>
                ) : filteredUnits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-zinc-400">
                        <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                            <Building2 size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-600 dark:text-zinc-300">Nenhuma unidade encontrada</h3>
                        <p className="text-sm">Tente buscar por outro termo.</p>
                    </div>
                ) : (
                    filteredUnits.map(unit => {
                        const unitProposals = proposals.filter(p => p.unidade_id === unit.id);
                        const isExpanded = expandedUnitId === unit.id;

                        // Ordenar propostas (mais recentes primeiro para o visual "histórico")
                        const sortedProposals = [...unitProposals].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                        return (
                            <div
                                key={unit.id}
                                className={`bg-white dark:bg-zinc-900 rounded-[2.5rem] p-2 transition-all duration-500 ${isExpanded ? 'shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)]' : 'shadow-sm hover:shadow-md'}`}
                            >
                                <div
                                    onClick={() => setExpandedUnitId(isExpanded ? null : unit.id)}
                                    className="p-6 flex items-center justify-between cursor-pointer rounded-[2rem] hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors group"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${isExpanded ? 'bg-[#118b89] text-white' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:bg-white group-hover:shadow-sm'}`}>
                                            <Building2 size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-xl text-zinc-900 dark:text-white tracking-tight leading-tight">{unit.nome_unidade}</h3>
                                            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{unit.clientName}</p>
                                            <p className="text-xs font-semibold text-zinc-400 mt-1">{unitProposals.length} propostas geradas</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 transition-all duration-300 ${isExpanded ? 'bg-[#118b89]/10 text-[#118b89] rotate-180' : 'text-zinc-400 group-hover:bg-white group-hover:shadow-sm'}`}>
                                        <ChevronDown size={20} />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-6 pb-6 pt-2 animate-in slide-in-from-top-4 fade-in duration-300">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800"></div>
                                            <span className="text-[10px] font-extrabold uppercase text-zinc-300 dark:text-zinc-600 tracking-widest">Histórico de Propostas</span>
                                            <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800"></div>
                                        </div>

                                        {sortedProposals.length === 0 ? (
                                            <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-100 dark:border-zinc-800 border-dashed">
                                                <p className="text-sm font-medium text-zinc-400">Nenhuma proposta registrada.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {sortedProposals.map(proposal => (
                                                    <button
                                                        key={proposal.id}
                                                        onClick={() => handleProposalClick(proposal.id)}
                                                        className="bg-white dark:bg-black/20 p-5 rounded-[1.5rem] border border-zinc-100 dark:border-white/5 shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 text-left group/card relative overflow-hidden"
                                                    >
                                                        <div className="flex justify-between items-start mb-4">
                                                            <span className={`text-lg font-extrabold tracking-tight ${getProposalIdColor(proposal.status)}`}>
                                                                #{proposal.id}
                                                            </span>
                                                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${getProposalStatusBadge(proposal.status)}`}>
                                                                {getProposalStatusLabel(proposal.status)}
                                                            </span>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
                                                                <Calendar size={14} />
                                                                <span className="text-xs font-semibold">{new Date(proposal.created_at).toLocaleDateString('pt-BR')}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
                                                                <span className="text-lg font-bold">
                                                                    {proposal.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Proposal Summary Modal - keeping same structure */}
            {selectedProposalId && fullProposalDetails && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]"
                    >
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900">
                            <div>
                                <h3 className="font-bold text-2xl text-zinc-900 dark:text-white tracking-tight">
                                    Proposta #{selectedProposalId}
                                </h3>
                                <p className="text-sm text-zinc-500">Detalhes completos do orçamento</p>
                            </div>
                            <button onClick={() => setSelectedProposalId(null)} className="w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#F8FAFC] dark:bg-black/20">
                            {/* Reusing existing details logic purely primarily styling updates on wrapper */}
                            <div className="space-y-8">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 text-center">
                                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Status</span>
                                        <StatusBadge status={fullProposalDetails.status} />
                                    </div>
                                    <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 text-center">
                                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Data</span>
                                        <span className="font-bold text-zinc-700 dark:text-zinc-200">{new Date(fullProposalDetails.created_at).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 text-center">
                                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Total</span>
                                        <span className="font-extrabold text-[#118b89]">{fullProposalDetails.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-extrabold uppercase text-zinc-400 mb-4 tracking-widest">Itens do Orçamento</h4>
                                    <div className="space-y-3">
                                        {fullProposalDetails.itens.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-4 rounded-2xl bg-white dark:bg-zinc-800 border border-dashed border-zinc-200 dark:border-zinc-700">
                                                <div>
                                                    <p className="font-bold text-zinc-800 dark:text-zinc-100">{item.procedimento.nome}</p>
                                                    <p className="text-xs font-semibold text-zinc-400 mt-1 uppercase">{item.modulo.nome}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-zinc-900 dark:text-zinc-100">
                                                        {(item.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </p>
                                                    <p className="text-xs text-zinc-400">x{item.quantidade}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
