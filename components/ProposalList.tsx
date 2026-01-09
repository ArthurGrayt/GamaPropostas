import React, { useState, useMemo, useEffect } from 'react';
import { EnrichedProposal, ProposalStatus } from '../types';
import { GlassCard, Avatar, SearchBar, FilterPill } from './UIComponents';
import { ChevronRight, Calendar, DollarSign, CheckCircle, XCircle, Clock, Archive, Plus, FileText, Loader2, ListTodo } from 'lucide-react';
import { generateProposalPdf } from '../services/pdfGenerator';
import { getProposalById } from '../services/mockData';


interface Props {
    proposals: EnrichedProposal[];
    onStatusChange: (id: number, newStatus: ProposalStatus) => void;

    onCreate: () => void;
}

type FilterType = 'ALL' | ProposalStatus;

export const ProposalList: React.FC<Props> = ({ proposals, onSelect, onStatusChange, onCreate }) => {

    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
    const [dateFilter, setDateFilter] = useState<{
        type: 'ALL' | 'DATE' | 'MONTH';
        value: string;
    }>({ type: 'ALL', value: '' });

    const [isGeneratingPdf, setIsGeneratingPdf] = useState<number | null>(null);

    // Persistence State
    const [savedProposal, setSavedProposal] = useState<{ clientName: string } | null>(null);

    useEffect(() => {
        const checkSaved = () => {
            const saved = localStorage.getItem('SECUREFLOW_CART_STATE');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Object.keys(parsed.selectedItemsMap || {}).length > 0) {
                        setSavedProposal({ clientName: parsed.clientName || 'Rascunho' });
                    } else {
                        setSavedProposal(null);
                    }
                } catch {
                    setSavedProposal(null);
                }
            } else {
                setSavedProposal(null);
            }
        };

        checkSaved();

        // Listen for storage events (optional, but good if creating proposal in another tab)
        window.addEventListener('storage', checkSaved);
        return () => window.removeEventListener('storage', checkSaved);
    }, []);

    const { activeProposals, archivedProposals } = useMemo(() => {
        const active = proposals.filter(p => p.status !== 'ARCHIVED');
        const archived = proposals.filter(p => p.status === 'ARCHIVED');
        return { activeProposals: active, archivedProposals: archived };
    }, [proposals]);

    const getDateMatches = (p: EnrichedProposal) => {
        if (dateFilter.type === 'ALL' || !dateFilter.value) return true;

        const proposalDate = new Date(p.created_at);
        const year = proposalDate.getFullYear();
        const month = String(proposalDate.getMonth() + 1).padStart(2, '0');

        if (dateFilter.type === 'DATE') {
            const day = String(proposalDate.getDate()).padStart(2, '0');
            const pDateStr = `${year}-${month}-${day}`;
            return pDateStr === dateFilter.value;
        } else if (dateFilter.type === 'MONTH') {
            const pMonthStr = `${year}-${month}`;
            return pMonthStr === dateFilter.value;
        }
        return true;
    };

    const dateFilteredActiveProposals = useMemo(() => {
        return activeProposals.filter(getDateMatches);
    }, [activeProposals, dateFilter]);

    const dateFilteredArchivedProposals = useMemo(() => {
        return archivedProposals.filter(getDateMatches);
    }, [archivedProposals, dateFilter]);

    const filteredProposals = useMemo(() => {
        let sourceData = activeFilter === 'ARCHIVED' ? dateFilteredArchivedProposals : dateFilteredActiveProposals;

        // 1. Filter by Status (if not ALL and not ARCHIVED logic) - handled partly by sourceData selection
        if (activeFilter !== 'ALL' && activeFilter !== 'ARCHIVED') {
            sourceData = sourceData.filter(p => p.status === activeFilter);
        }

        // 2. Filter by Date (Already done in sourceData)

        // 3. Filter by Search Query
        if (!searchQuery) {
            return sourceData;
        }

        return sourceData.filter(p =>
            p.cliente.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(p.id).includes(searchQuery)
        );
    }, [dateFilteredActiveProposals, dateFilteredArchivedProposals, searchQuery, activeFilter]);

    const getStatusVisuals = (status: string) => {
        switch (status) {
            case 'APPROVED': return {
                icon: CheckCircle,
                color: 'text-emerald-600 dark:text-emerald-400',
                bg: 'bg-emerald-500/5 hover:bg-emerald-500/10',
                iconBg: 'bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/30'
            };
            case 'REJECTED': return {
                icon: XCircle,
                color: 'text-rose-600 dark:text-rose-400',
                bg: 'bg-rose-500/5 hover:bg-rose-500/10',
                iconBg: 'bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 dark:hover:bg-rose-500/30'
            };
            case 'ARCHIVED': return {
                icon: Archive,
                color: 'text-zinc-500 dark:text-zinc-400',
                bg: 'bg-zinc-500/5 hover:bg-zinc-500/10',
                iconBg: 'bg-zinc-200 dark:bg-zinc-700/30 hover:bg-zinc-300 dark:hover:bg-zinc-700/50'
            };
            default: return {
                icon: Clock,
                color: 'text-amber-600 dark:text-amber-400',
                bg: 'bg-amber-500/5 hover:bg-amber-500/10',
                iconBg: 'bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30'
            };
        }
    };

    const handleIconClick = (e: React.MouseEvent, id: number, currentStatus: string) => {
        e.stopPropagation(); // Impede que o card abra os detalhes

        // Ciclo: PENDING -> APPROVED -> REJECTED -> PENDING
        let nextStatus: ProposalStatus = 'PENDING';
        if (currentStatus === 'PENDING') nextStatus = 'APPROVED';
        else if (currentStatus === 'APPROVED') nextStatus = 'REJECTED';
        else if (currentStatus === 'REJECTED') nextStatus = 'PENDING';

        onStatusChange(id, nextStatus);
    };

    const handleGeneratePdf = async (e: React.MouseEvent, proposalId: number) => {
        e.stopPropagation();
        setIsGeneratingPdf(proposalId);
        try {
            const fullProposal = await getProposalById(proposalId);
            if (fullProposal) {
                await generateProposalPdf(fullProposal);
            } else {
                alert('Não foi possível carregar os dados completos da proposta.');
            }
        } catch (error) {
            console.error("PDF Generation Error: ", error);
            alert('Ocorreu um erro ao gerar o PDF.');
        } finally {
            setIsGeneratingPdf(null);
        }
    };


    return (
        <div className="space-y-6 pb-24 relative">
            {/* Header */}
            <header className="flex items-end justify-between">
                <div>
                    <h1 className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">
                        Gama Propostas
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium text-lg">
                        Gestão de Segurança
                    </p>
                </div>


            </header>

            {/* Barra de Busca e Filtros */}
            <section className="space-y-4">
                {savedProposal && (
                    <div className="animate-fade-in mb-4">
                        <button
                            onClick={onCreate}
                            className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl flex items-center justify-between group hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-600/20">
                                    <ListTodo size={20} />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-blue-700 dark:text-blue-300">Continuar Proposta</h3>
                                    <p className="text-sm text-blue-600/80 dark:text-blue-400/80">
                                        Retomar rascunho de <span className="font-semibold">{savedProposal.clientName}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-blue-950 p-2 rounded-full text-blue-600 dark:text-blue-400 shadow-sm group-hover:scale-110 transition-transform">
                                <ChevronRight size={20} />
                            </div>
                        </button>
                    </div>
                )}

                <div className="flex flex-col md:flex-row gap-4">
                    <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Buscar por cliente ou ID..."
                        className="flex-grow"
                    />

                    {/* Date Filters */}
                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <select
                            value={dateFilter.type}
                            onChange={(e) => setDateFilter({ type: e.target.value as any, value: '' })}
                            className="bg-transparent text-sm font-medium text-zinc-700 dark:text-zinc-300 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="ALL">Todas as datas</option>
                            <option value="DATE">Por Dia</option>
                            <option value="MONTH">Por Mês</option>
                        </select>

                        {dateFilter.type !== 'ALL' && (
                            <input
                                type={dateFilter.type === 'DATE' ? 'date' : 'month'}
                                value={dateFilter.value}
                                onChange={(e) => setDateFilter(prev => ({ ...prev, value: e.target.value }))}
                                className="bg-zinc-100 dark:bg-zinc-900 border-none text-sm text-zinc-700 dark:text-zinc-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500"
                            />
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <FilterPill
                        label="Todas"
                        isActive={activeFilter === 'ALL'}
                        onClick={() => setActiveFilter('ALL')}
                        count={dateFilteredActiveProposals.length}
                    />
                    <FilterPill
                        label="Pendentes"
                        isActive={activeFilter === 'PENDING'}
                        onClick={() => setActiveFilter('PENDING')}
                        count={dateFilteredActiveProposals.filter(p => p.status === 'PENDING').length}
                    />
                    <FilterPill
                        label="Aprovadas"
                        isActive={activeFilter === 'APPROVED'}
                        onClick={() => setActiveFilter('APPROVED')}
                        count={dateFilteredActiveProposals.filter(p => p.status === 'APPROVED').length}
                    />
                    <FilterPill
                        label="Reprovadas"
                        isActive={activeFilter === 'REJECTED'}
                        onClick={() => setActiveFilter('REJECTED')}
                        count={dateFilteredActiveProposals.filter(p => p.status === 'REJECTED').length}
                    />
                    <FilterPill
                        label="Arquivadas"
                        isActive={activeFilter === 'ARCHIVED'}
                        onClick={() => setActiveFilter('ARCHIVED')}
                        count={dateFilteredArchivedProposals.length}
                    />
                </div>
            </section>

            {/* Grid de Cards */}
            {filteredProposals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                    {filteredProposals.map((prop) => {
                        const { icon: StatusIcon, color: statusColor, bg: statusBg, iconBg } = getStatusVisuals(prop.status);

                        return (
                            <GlassCard key={prop.id} onClick={() => onSelect(prop.id)} className={`group relative overflow-hidden transition-all duration-300 hover:shadow-2xl ${statusBg} border-opacity-50`}>

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-3 pr-2 overflow-hidden">
                                            <Avatar src={prop.cliente.avatar || ''} alt={prop.cliente.nome} />
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-lg text-zinc-800 dark:text-white leading-tight truncate">
                                                    {prop.cliente.nome}
                                                </h3>
                                                <span className="text-xs text-zinc-500 font-medium">#{prop.id}</span>
                                            </div>
                                        </div>

                                        {/* Ícone de Status Interativo */}
                                        <div
                                            role="button"
                                            aria-label={`Alterar status atual: ${prop.status}`}
                                            onClick={(e) => handleIconClick(e, prop.id, prop.status)}
                                            title="Clique para alterar o status"
                                            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${iconBg} ${statusColor} backdrop-blur-md shadow-sm border border-white/10 cursor-pointer transition-transform duration-200 active:scale-90 hover:scale-110`}
                                        >
                                            <StatusIcon size={16} strokeWidth={2.5} />
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-6 flex-grow">
                                        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                                            <div className="p-1.5 bg-stone-100 dark:bg-zinc-800 rounded-lg">
                                                <Calendar size={16} />
                                            </div>
                                            <span className="text-sm font-medium">
                                                {new Date(prop.created_at).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                                            <div className="p-1.5 bg-stone-100 dark:bg-zinc-800 rounded-lg">
                                                <DollarSign size={16} />
                                            </div>
                                            <span className="text-sm font-medium">
                                                {prop.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-neutral-200/50 dark:border-white/10">
                                        <span className="text-sm font-semibold text-zinc-400">
                                            {prop.itens.length} {prop.itens.length === 1 ? 'item' : 'itens'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => handleGeneratePdf(e, prop.id)}
                                                title="Gerar PDF"
                                                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:bg-blue-500 hover:text-white transition-colors duration-300"
                                                disabled={isGeneratingPdf === prop.id}
                                            >
                                                {isGeneratingPdf === prop.id ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                                            </button>
                                            <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300">
                                                <ChevronRight size={18} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </GlassCard>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-400 animate-fade-in">
                    <div className="bg-zinc-100 dark:bg-zinc-800 p-6 rounded-full mb-4">
                        <Archive size={40} />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-600 dark:text-zinc-300">Nenhuma proposta encontrada</h3>
                    <p className="text-sm">Tente ajustar seus filtros ou termos de busca.</p>
                </div>
            )}

            {/* Floating Action Button (FAB) for Creating Proposal */}
            <button
                onClick={onCreate}
                className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 z-50 group"
                aria-label="Criar nova proposta"
            >
                <Plus size={28} />
                <span className="absolute right-full mr-3 bg-zinc-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Nova Proposta
                </span>
            </button>
        </div>
    );
};