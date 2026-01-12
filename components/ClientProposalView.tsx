import React, { useState, useEffect, useMemo } from 'react';
import { EnrichedProposal, EnrichedItem, ItemStatus, ProposalStatus } from '../types';
import { getProposalById, updateItemStatus, updateProposalStatus } from '../services/mockData';
import { GlassCard, StatusBadge, Avatar } from './UIComponents';
import { CheckCircle, XCircle, Clock, Box, ChevronDown, Trophy, Package, AlertCircle, Loader2, Check, X } from 'lucide-react';

interface Props {
    proposalId: number;
}

const ITEM_STATUSES: Record<ItemStatus, { label: string; icon: React.ElementType; color: string; progress: number; }> = {
    'PENDING': { label: 'Pendente', icon: Clock, color: 'text-zinc-500', progress: 0 },
    'APPROVED': { label: 'Aprovado', icon: CheckCircle, color: 'text-emerald-500', progress: 100 },
    'REJECTED': { label: 'Reprovado', icon: XCircle, color: 'text-red-500', progress: 100 },
};

export const ClientProposalView: React.FC<Props> = ({ proposalId }) => {
    const [proposal, setProposal] = useState<EnrichedProposal | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({});
    const [updatingItems, setUpdatingItems] = useState<Record<number, boolean>>({});

    useEffect(() => {
        const fetchProposal = async () => {
            setIsLoading(true);
            const data = await getProposalById(proposalId);
            setProposal(data || null);
            setIsLoading(false);

            if (data && data.itens) {
                const initialExpanded: Record<number, boolean> = {};
                data.itens.forEach(i => {
                    if (i.modulo) initialExpanded[i.modulo.id] = true;
                });
                setExpandedModules(initialExpanded);
            }
        };
        fetchProposal();
    }, [proposalId]);

    const handleItemAction = async (item: EnrichedItem, newStatus: ItemStatus) => {
        if (!proposal) return;

        setUpdatingItems(prev => ({ ...prev, [item.id]: true }));
        await updateItemStatus(item.id, newStatus);

        // Optimistic update locally
        const updatedItems = proposal.itens.map(i =>
            i.id === item.id ? { ...i, status: newStatus } : i
        );

        // Check if all items are resolved to update proposal status
        // Logic similar to ProposalDetail
        const allItemsSameStatus = updatedItems.every(i => i.status === newStatus);
        let newProposalStatus = proposal.status;

        if (allItemsSameStatus && ['APPROVED', 'PENDING', 'REJECTED'].includes(newStatus)) {
            newProposalStatus = newStatus as ProposalStatus;
            await updateProposalStatus(proposal.id, newProposalStatus);
        }

        setProposal({
            ...proposal,
            itens: updatedItems,
            status: newProposalStatus
        });

        setUpdatingItems(prev => ({ ...prev, [item.id]: false }));
    };

    const groupedItems = useMemo(() => {
        if (!proposal) return {};
        const groups: Record<number, { nome: string; items: EnrichedItem[] }> = {};

        proposal.itens.forEach(item => {
            if (!item.modulo) return;
            if (!groups[item.modulo.id]) {
                groups[item.modulo.id] = { nome: item.modulo.nome, items: [] };
            }
            groups[item.modulo.id].items.push(item);
        });

        return groups;
    }, [proposal]);

    const progress = useMemo(() => {
        if (!proposal || proposal.itens.length === 0) return 0;
        const totalProgress = proposal.itens.reduce((acc, item) => {
            return acc + (ITEM_STATUSES[item.status]?.progress || 0);
        }, 0);
        return totalProgress / proposal.itens.length;
    }, [proposal]);

    const isComplete = progress === 100;

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-black text-zinc-500">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
                <p>Carregando proposta...</p>
            </div>
        );
    }

    if (!proposal) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-black text-zinc-500 p-4 text-center">
                <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
                <h1 className="text-xl font-bold text-zinc-800 dark:text-white mb-2">Proposta não encontrada</h1>
                <p>O link pode estar expirado ou incorreto.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 font-sans selection:bg-blue-500/30 pb-20">


            <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
                {/* Header Logo */}
                <div className="flex justify-center pb-4">
                    <img src="/logo-gama.png" alt="Logo" className="h-16 object-contain" />
                </div>

                {/* Client Welcome Card */}
                <GlassCard className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                            Olá, {proposal.cliente.nome}
                        </h2>
                        <p className="text-zinc-500 dark:text-zinc-400 max-w-xl">
                            Preparamos esta proposta personalizada para você.
                            Por favor, analise os itens abaixo e confirme sua aprovação.
                        </p>
                    </div>
                </GlassCard>

                {/* Progress Bar & Actions */}
                <div className="bg-white/50 dark:bg-zinc-900/50 rounded-2xl p-5 border border-white/20 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">Status de Aprovação</span>
                            <span className={`text-2xl font-bold ${isComplete ? 'text-emerald-600' : 'text-blue-600'}`}>{Math.round(progress)}%</span>
                        </div>
                    </div>
                    <div className="w-full h-4 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-700 ease-out ${isComplete ? 'bg-emerald-500' : 'bg-blue-600'}`}
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>

                {/* Modules & Items */}
                <div className="space-y-6">
                    {Object.entries(groupedItems).map(([modIdStr, groupData]) => {
                        const group = groupData as { nome: string; items: EnrichedItem[] };
                        const modId = parseInt(modIdStr);
                        const isExpanded = expandedModules[modId];

                        return (
                            <div key={modId} className="space-y-3">
                                <div
                                    onClick={() => setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }))}
                                    className="flex items-center justify-between cursor-pointer group select-none bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-900 transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg font-bold text-zinc-800 dark:text-white">{group.nome}</h3>
                                    </div>
                                    <ChevronDown className={`text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>

                                {isExpanded && (
                                    <div className="space-y-3 animate-slide-in p-1">
                                        {group.items.map(item => (
                                            <div
                                                key={item.uiKey}
                                                className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm rounded-xl p-4 border border-zinc-100 dark:border-zinc-800/50 shadow-sm flex flex-col gap-4"
                                            >
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-zinc-800 dark:text-zinc-100 mb-2 text-base">
                                                        {item.procedimento.nome}
                                                    </h4>
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500">
                                                        <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs font-medium">{item.quantidade}x</span>
                                                        <span className="font-mono text-zinc-700 dark:text-zinc-300 font-bold">
                                                            {(item.total || item.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </span>
                                                        {item.data_para_entrega && (
                                                            <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/30">
                                                                <Clock size={12} />
                                                                <span className="font-semibold">Prazo: {new Date(item.data_para_entrega).toLocaleDateString('pt-BR')}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/50 sm:border-t-0 sm:pt-0 sm:justify-end">
                                                    {item.status === 'APPROVED' ? (
                                                        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 px-3 py-2 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-medium border border-emerald-200 dark:border-emerald-800">
                                                            <div className="flex items-center gap-2">
                                                                <CheckCircle size={16} />
                                                                <span>Aprovado</span>
                                                            </div>
                                                            <button
                                                                onClick={() => handleItemAction(item, 'PENDING')}
                                                                className="ml-2 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded p-1"
                                                                title="Desfazer"
                                                                disabled={updatingItems[item.id]}
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    ) : item.status === 'REJECTED' ? (
                                                        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm font-medium border border-red-200 dark:border-red-800">
                                                            <div className="flex items-center gap-2">
                                                                <XCircle size={16} />
                                                                <span>Reprovado</span>
                                                            </div>
                                                            <button
                                                                onClick={() => handleItemAction(item, 'PENDING')}
                                                                className="ml-2 hover:bg-red-200 dark:hover:bg-red-800 rounded p-1"
                                                                title="Desfazer"
                                                                disabled={updatingItems[item.id]}
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex w-full sm:w-auto items-center gap-2">
                                                            <button
                                                                onClick={() => handleItemAction(item, 'REJECTED')}
                                                                disabled={updatingItems[item.id]}
                                                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/10 dark:hover:text-red-400 dark:hover:border-red-900 transition-all rounded-lg text-sm font-medium active:scale-95 disabled:opacity-50"
                                                            >
                                                                {updatingItems[item.id] ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                                                                Reprovar
                                                            </button>
                                                            <button
                                                                onClick={() => handleItemAction(item, 'APPROVED')}
                                                                disabled={updatingItems[item.id]}
                                                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all rounded-lg text-sm font-medium active:scale-95 disabled:opacity-50"
                                                            >
                                                                {updatingItems[item.id] ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                                Aprovar
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer Total */}
                <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center mb-24">
                    <span className="text-zinc-500">Valor Total Estimado</span>
                    <span className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {proposal.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                </div>
            </main>

            {/* Fixed Bottom Action Bar */}
            {!isComplete && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 z-50 animate-slide-up-fade">
                    <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                        <div className="hidden sm:block">
                            <span className="text-xs text-zinc-500 uppercase tracking-wider font-bold block">Total da Proposta</span>
                            <span className="text-xl font-bold text-zinc-900 dark:text-white">
                                {proposal.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                        <button
                            onClick={() => {
                                if (window.confirm("Deseja aprovar todos os itens pendentes?")) {
                                    proposal.itens.forEach(item => {
                                        if (item.status !== 'APPROVED') {
                                            handleItemAction(item, 'APPROVED');
                                        }
                                    });
                                }
                            }}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-lg font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                        >
                            <CheckCircle size={24} />
                            Aprovar Proposta Completa
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
