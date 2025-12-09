import React, { useState, useMemo } from 'react';
import { EnrichedProposal, ProposalStatus } from '../types';
import { GlassCard, Avatar, SearchBar, FilterPill } from './UIComponents';
import { ChevronRight, Calendar, DollarSign, CheckCircle, XCircle, Clock, Moon, Sun, Archive, Plus, SlidersHorizontal, FileText, Loader2 } from 'lucide-react';
import { generateProposalPdf } from '../services/pdfGenerator';
import { getProposalById } from '../services/mockData';


interface Props {
    proposals: EnrichedProposal[];
    onSelect: (id: number) => void;
    onStatusChange: (id: number, newStatus: ProposalStatus) => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    onCreate: () => void;
    onNavigateToSettings: () => void;
}

type FilterType = 'ALL' | ProposalStatus;

export const ProposalList: React.FC<Props> = ({ proposals, onSelect, onStatusChange, isDarkMode, onToggleTheme, onCreate, onNavigateToSettings }) => {

    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<number | null>(null);

    const { activeProposals, archivedProposals } = useMemo(() => {
        const active = proposals.filter(p => p.status !== 'ARCHIVED');
        const archived = proposals.filter(p => p.status === 'ARCHIVED');
        return { activeProposals: active, archivedProposals: archived };
    }, [proposals]);

    const filteredProposals = useMemo(() => {
        const sourceData = activeFilter === 'ARCHIVED' ? archivedProposals : activeProposals;

        const sourceWithStatusFilter = (activeFilter === 'ALL' || activeFilter === 'ARCHIVED')
            ? sourceData
            : sourceData.filter(p => p.status === activeFilter);

        if (!searchQuery) {
            return sourceWithStatusFilter;
        }

        return sourceWithStatusFilter.filter(p =>
            p.cliente.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(p.id).includes(searchQuery)
        );
    }, [activeProposals, archivedProposals, searchQuery, activeFilter]);

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

                <div className="flex items-center gap-2">
                    <button
                        onClick={onNavigateToSettings}
                        className="w-12 h-12 rounded-full flex items-center justify-center bg-white/50 dark:bg-zinc-800/50 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-sm text-zinc-600 dark:text-zinc-300 hover:bg-white/80 dark:hover:bg-zinc-700/80 transition-all active:scale-95"
                        aria-label="Editar Preços"
                    >
                        <SlidersHorizontal size={22} />
                    </button>
                    <button
                        onClick={onToggleTheme}
                        className="w-12 h-12 rounded-full flex items-center justify-center bg-white/50 dark:bg-zinc-800/50 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-sm text-zinc-600 dark:text-zinc-300 hover:bg-white/80 dark:hover:bg-zinc-700/80 transition-all active:scale-95"
                        aria-label="Alternar tema"
                    >
                        {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
                    </button>
                </div>
            </header>

            {/* Barra de Busca e Filtros */}
            <section className="space-y-4">
                <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Buscar por cliente ou ID..."
                />

                <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <FilterPill
                        label="Todas"
                        isActive={activeFilter === 'ALL'}
                        onClick={() => setActiveFilter('ALL')}
                        count={activeProposals.length}
                    />
                    <FilterPill
                        label="Pendentes"
                        isActive={activeFilter === 'PENDING'}
                        onClick={() => setActiveFilter('PENDING')}
                        count={activeProposals.filter(p => p.status === 'PENDING').length}
                    />
                    <FilterPill
                        label="Aprovadas"
                        isActive={activeFilter === 'APPROVED'}
                        onClick={() => setActiveFilter('APPROVED')}
                        count={activeProposals.filter(p => p.status === 'APPROVED').length}
                    />
                    <FilterPill
                        label="Reprovadas"
                        isActive={activeFilter === 'REJECTED'}
                        onClick={() => setActiveFilter('REJECTED')}
                        count={activeProposals.filter(p => p.status === 'REJECTED').length}
                    />
                    <FilterPill
                        label="Arquivadas"
                        isActive={activeFilter === 'ARCHIVED'}
                        onClick={() => setActiveFilter('ARCHIVED')}
                        count={archivedProposals.length}
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