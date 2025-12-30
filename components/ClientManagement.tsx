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

    const getProposalStatusColor = (status: ProposalStatus) => {
        switch (status) {
            case 'APPROVED': return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
            case 'REJECTED': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
            case 'PENDING': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
            default: return 'text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
        }
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

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-[#050505] animate-fade-in pb-10">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-stone-100/80 dark:bg-[#050505]/80 backdrop-blur-xl border-b border-neutral-200/50 dark:border-white/5 px-4 pt-6 pb-4 space-y-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                        <ArrowLeft />
                    </button>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                        Gerenciar Unidades
                        <span className="text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700">
                            {units.length}
                        </span>
                    </h1>
                </div>
                <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Buscar unidade ou cliente..."
                />
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center px-2">Propostas:</span>
                        <FilterPill
                            label="Todos"
                            isActive={statusFilter === 'ALL'}
                            onClick={() => setStatusFilter('ALL')}
                        />
                        <FilterPill
                            label="Com Pendências"
                            isActive={statusFilter === 'PENDING'}
                            onClick={() => setStatusFilter('PENDING')}
                        />
                        <FilterPill
                            label="Aprovados"
                            isActive={statusFilter === 'APPROVED'}
                            onClick={() => setStatusFilter('APPROVED')}
                        />
                        <FilterPill
                            label="Reprovados"
                            isActive={statusFilter === 'REJECTED'}
                            onClick={() => setStatusFilter('REJECTED')}
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 mt-6 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <p>Carregando unidades...</p>
                    </div>
                ) : filteredUnits.length === 0 ? (
                    <div className="text-center py-20 text-zinc-400">
                        <p>Nenhuma unidade encontrada.</p>
                    </div>
                ) : (
                    filteredUnits.map(unit => {
                        const unitProposals = proposals.filter(p => p.unidade_id === unit.id);
                        const isExpanded = expandedUnitId === unit.id;

                        return (
                            <GlassCard key={unit.id} className="overflow-hidden transition-all duration-300">
                                <div
                                    onClick={() => setExpandedUnitId(isExpanded ? null : unit.id)}
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0">
                                            <Building2 size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-zinc-800 dark:text-white">{unit.nome_unidade}</h3>
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400">{unit.clientName}</p>
                                            <p className="text-xs text-zinc-400 mt-1">{unitProposals.length} propostas geradas</p>
                                        </div>
                                    </div>
                                    <div className={`p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                        <ChevronDown size={20} className="text-zinc-500" />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-neutral-200 dark:border-white/10 bg-zinc-50/50 dark:bg-black/20 p-4 animate-slide-in">
                                        <h4 className="text-xs font-bold uppercase text-zinc-400 tracking-wider mb-3">Histórico de Propostas</h4>
                                        {unitProposals.length === 0 ? (
                                            <p className="text-sm text-zinc-500 italic">Nenhuma proposta encontrada para esta unidade.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {unitProposals.map(proposal => (
                                                    <button
                                                        key={proposal.id}
                                                        onClick={() => handleProposalClick(proposal.id)}
                                                        className={`text-left p-3 rounded-xl border transition-all hover:shadow-md active:scale-95 flex flex-col gap-2 ${getProposalStatusColor(proposal.status)}`}
                                                    >
                                                        <div className="flex justify-between items-start w-full">
                                                            <span className="font-bold text-sm">#{proposal.id}</span>
                                                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-white/50 dark:bg-black/20 border border-black/5">
                                                                {getProposalStatusLabel(proposal.status)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs opacity-80">
                                                            <Calendar size={12} />
                                                            <span>{new Date(proposal.created_at).toLocaleDateString('pt-BR')}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs font-semibold mt-auto">
                                                            <DollarSign size={12} />
                                                            <span>{proposal.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </GlassCard>
                        );
                    })
                )}
            </div>

            {/* Proposal Summary Modal (Unchanged) */}
            {selectedProposalId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-scale-in flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
                            <h3 className="font-bold text-lg text-zinc-800 dark:text-white flex items-center gap-2">
                                <FileText size={20} className="text-blue-500" />
                                Resumo da Proposta #{selectedProposalId}
                            </h3>
                            <button onClick={() => setSelectedProposalId(null)} className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {loadingDetails || !fullProposalDetails ? (
                                <div className="flex flex-col items-center justify-center py-10 text-zinc-500">
                                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                    <p>Carregando detalhes...</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex flex-wrap gap-4 justify-between items-center p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                        <div>
                                            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Status</p>
                                            <StatusBadge status={fullProposalDetails.status} />
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Data</p>
                                            <p className="font-semibold text-zinc-800 dark:text-zinc-200">{new Date(fullProposalDetails.created_at).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total</p>
                                            <p className="font-bold text-lg text-zinc-900 dark:text-white">{fullProposalDetails.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold uppercase text-zinc-500 mb-3 flex items-center gap-2">
                                            <Package size={16} /> Itens da Proposta
                                        </h4>
                                        <div className="space-y-2">
                                            {fullProposalDetails.itens.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-start p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/50">
                                                    <div className="flex-1 pr-4">
                                                        <p className="font-medium text-zinc-800 dark:text-zinc-200">{item.procedimento.nome}</p>
                                                        <p className="text-xs text-zinc-500 mt-0.5">{item.modulo.nome} • {item.categoria.nome}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
                                                            {(item.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </p>
                                                        <p className="text-xs text-zinc-500">Qtd: {item.quantidade}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
