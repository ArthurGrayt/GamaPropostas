
import React, { useState, useEffect, useMemo } from 'react';
import { CatalogContext, fetchCatalogData, updateProcedurePrice, createProcedure, updateProcedureName, deleteProcedure } from '../services/mockData';
import { GlassCard, SearchBar, FilterPill } from './UIComponents';
import { ArrowLeft, Layers, List, Loader2, Save, CheckCircle, AlertCircle, Plus, X, Tag, ChevronDown, Pencil, Trash2, Check } from 'lucide-react';
import { Modulo, Categoria, Procedimento } from '../types';

interface Props {
    onBack: () => void;
}

type RenderNode = {
    modulo: Modulo;
    categorias: { data: Categoria; procedimentos: Procedimento[] }[];
};

type PriceTierKey = 'preco_avulso' | 'preco_particular' | 'preco_parceiro' | 'preco_clientegama' | 'preco_premium';

const priceTiers: Record<PriceTierKey, string> = {
    preco_avulso: 'Avulso',
    preco_particular: 'Particular',
    preco_parceiro: 'Parceiro',
    preco_clientegama: 'Cliente Gama',
    preco_premium: 'Premium',
};

type ProcedureChanges = {
    [key in PriceTierKey | 'preco']?: number | null;
}

export const PriceEditor: React.FC<Props> = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [catalog, setCatalog] = useState<CatalogContext>({ modulos: [], categorias: [], procedimentos: [], clientes: [] });
    const [procedureChanges, setProcedureChanges] = useState<Record<number, ProcedureChanges>>({});
    const [savingState, setSavingState] = useState<Record<number, 'idle' | 'saving' | 'saved' | 'error'>>({});

    const [searchQuery, setSearchQuery] = useState('');
    const [activeModuloId, setActiveModuloId] = useState<number | 'ALL'>('ALL');
    const [activeCategoriaId, setActiveCategoriaId] = useState<number | 'ALL'>('ALL');

    // Creation Modal State
    const [isCreating, setIsCreating] = useState(false);
    const [newProcName, setNewProcName] = useState('');
    const [newProcCategory, setNewProcCategory] = useState<number | ''>('');
    const [isCreatingLoading, setIsCreatingLoading] = useState(false);

    // Edit Name State
    const [editingNameId, setEditingNameId] = useState<number | null>(null);
    const [tempName, setTempName] = useState('');
    const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

    useEffect(() => {
        const load = async () => {
            const data = await fetchCatalogData();
            setCatalog(data);
            setLoading(false);
        };
        load();
    }, []);

    const filteredTree = useMemo(() => {
        if (!catalog.modulos.length) return [];
        return catalog.modulos.reduce<RenderNode[]>((tree, mod) => {
            if (activeModuloId !== 'ALL' && mod.id !== activeModuloId) return tree;
            const modNode: RenderNode = { modulo: mod, categorias: [] };
            catalog.categorias
                .filter(c => c.idmodulo === mod.id)
                .forEach(cat => {
                    if (activeCategoriaId !== 'ALL' && cat.id !== activeCategoriaId) return;
                    const procs = catalog.procedimentos.filter(p => {
                        const query = searchQuery.toLowerCase();
                        return p.idcategoria === cat.id && (!query ||
                            p.nome.toLowerCase().includes(query) ||
                            cat.nome.toLowerCase().includes(query) ||
                            mod.nome.toLowerCase().includes(query));
                    });
                    if (procs.length > 0) modNode.categorias.push({ data: cat, procedimentos: procs });
                });
            if (modNode.categorias.length > 0) tree.push(modNode);
            return tree;
        }, []);
    }, [catalog, activeModuloId, activeCategoriaId, searchQuery]);

    const handlePriceChange = (procId: number, tier: PriceTierKey, value: string) => {
        const numericValue = value === '' ? null : parseFloat(value);
        setProcedureChanges(prev => ({
            ...prev,
            [procId]: {
                ...prev[procId],
                [tier]: numericValue
            }
        }));
        // Reset save status on new change
        setSavingState(prev => ({ ...prev, [procId]: 'idle' }));
    };

    const handleSave = async (procId: number) => {
        const changes = procedureChanges[procId];
        if (!changes || Object.keys(changes).length === 0) return;

        setSavingState(prev => ({ ...prev, [procId]: 'saving' }));

        // Filter out null or non-numeric values before sending
        const payload: Partial<Procedimento> = {};
        for (const key in changes) {
            const value = changes[key as PriceTierKey];
            if (typeof value === 'number') {
                payload[key as PriceTierKey] = value;
            }
        }

        const success = await updateProcedurePrice(procId, payload);
        if (success) {
            setSavingState(prev => ({ ...prev, [procId]: 'saved' }));
            // Refresh local catalog data to reflect saved changes
            setCatalog(prev => ({
                ...prev,
                procedimentos: prev.procedimentos.map(p =>
                    p.id === procId ? { ...p, ...payload } : p
                )
            }));
            setProcedureChanges(prev => {
                const { [procId]: _, ...rest } = prev;
                return rest;
            });
            setTimeout(() => setSavingState(prev => ({ ...prev, [procId]: 'idle' })), 2000);
        } else {
            setSavingState(prev => ({ ...prev, [procId]: 'error' }));
        }
    };

    const handleCreateProcedure = async () => {
        if (!newProcName || !newProcCategory) return;
        setIsCreatingLoading(true);
        const result = await createProcedure(newProcName, Number(newProcCategory));
        setIsCreatingLoading(false);

        if (result.success && result.data) {
            // Update local catalog
            setCatalog(prev => ({
                ...prev,
                procedimentos: [...prev.procedimentos, result.data!]
            }));
            // Reset and close modal
            setNewProcName('');
            setNewProcCategory('');
            setIsCreating(false);
            alert('Procedimento criado com sucesso!');
        } else {
            alert(`Erro ao criar procedimento: ${result.error}`);
        }
    };

    const handleStartEditName = (proc: Procedimento) => {
        setEditingNameId(proc.id);
        setTempName(proc.nome);
    };

    const handleCancelEditName = () => {
        setEditingNameId(null);
        setTempName('');
    };

    const handleSaveName = async (id: number) => {
        if (!tempName.trim()) return;
        const result = await updateProcedureName(id, tempName);
        if (result.success) {
            setCatalog(prev => ({
                ...prev,
                procedimentos: prev.procedimentos.map(p => p.id === id ? { ...p, nome: tempName } : p)
            }));
            setEditingNameId(null);
        } else {
            alert('Erro ao atualizar nome.');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Tem certeza que deseja excluir este procedimento?')) return;
        setIsDeletingId(id);
        const result = await deleteProcedure(id);
        setIsDeletingId(null);

        if (result.success) {
            setCatalog(prev => ({
                ...prev,
                procedimentos: prev.procedimentos.filter(p => p.id !== id)
            }));
        } else {
            alert('Erro ao excluir procedimento.');
        }
    };

    const availableCategorias = useMemo(() => {
        if (activeModuloId === 'ALL') return [];
        return catalog.categorias.filter(c => c.idmodulo === activeModuloId);
    }, [catalog.categorias, activeModuloId]);

    const SaveButton: React.FC<{ procId: number }> = ({ procId }) => {
        const status = savingState[procId] || 'idle';
        const hasChanges = !!procedureChanges[procId] && Object.keys(procedureChanges[procId]).length > 0;

        switch (status) {
            case 'saving':
                return <Loader2 size={16} className="animate-spin text-blue-500" />;
            case 'saved':
                return <CheckCircle size={16} className="text-green-500" />;
            case 'error':
                return <AlertCircle size={16} className="text-red-500" />;
            default:
                return (
                    <button
                        onClick={() => handleSave(procId)}
                        disabled={!hasChanges}
                        className={`p-2 rounded-lg transition-colors ${hasChanges ? 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-800/50 text-blue-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'}`}
                    >
                        <Save size={16} />
                    </button>
                );
        }
    }

    if (loading) {
        return (<div className="flex h-screen items-center justify-center text-zinc-500"><Loader2 className="animate-spin mr-2" /> Carregando catálogo...</div>);
    }

    return (
        <div className="animate-fade-in bg-stone-50 dark:bg-[#050505] h-full flex flex-col relative overflow-hidden">
            <div className="z-20 bg-stone-100/80 dark:bg-[#050505]/80 backdrop-blur-xl border-b border-neutral-200/50 dark:border-white/5 pb-4 px-4 pt-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800"><ArrowLeft /></button>
                        <h1 className="text-xl font-bold">Gerenciamento de Itens</h1>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Novo Item</span>
                    </button>
                </div>
                <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Buscar procedimento..." className="mb-3" />
                <div className="space-y-2">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
                        <FilterPill label="Todos Módulos" isActive={activeModuloId === 'ALL'} onClick={() => { setActiveModuloId('ALL'); setActiveCategoriaId('ALL'); }} />
                        {catalog.modulos.map(m => (<FilterPill key={m.id} label={m.nome} isActive={activeModuloId === m.id} onClick={() => { setActiveModuloId(m.id); setActiveCategoriaId('ALL'); }} />))}
                    </div>
                    {activeModuloId !== 'ALL' && availableCategorias.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 animate-fade-in">
                            <FilterPill label="Todas Categorias" isActive={activeCategoriaId === 'ALL'} onClick={() => setActiveCategoriaId('ALL')} />
                            {availableCategorias.map(c => (<FilterPill key={c.id} label={c.nome} isActive={activeCategoriaId === c.id} onClick={() => setActiveCategoriaId(c.id)} />))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-28">
                <div className="px-4 space-y-6 mt-4 pb-4">
                    {!filteredTree.length && (<div className="text-center py-10 text-zinc-400"><p>Nenhum procedimento encontrado.</p></div>)}
                    {filteredTree.map(node => (
                        <div key={node.modulo.id} className="space-y-3">
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold uppercase text-sm tracking-wider sticky top-0 z-10 bg-stone-100/90 dark:bg-[#050505]/90 backdrop-blur-xl py-3 -mx-4 px-4 border-b border-neutral-200/50 dark:border-white/5"><Layers size={16} />{node.modulo.nome}</div>
                            {node.categorias.map(catNode => (
                                <div key={catNode.data.id} className="space-y-3">
                                    <div className="bg-zinc-50 dark:bg-white/5 px-4 py-2 border-b dark:border-white/5 -mb-2 ml-2"><span className="text-sm font-semibold flex items-center gap-2"><List size={14} /> {catNode.data.nome}</span></div>
                                    {catNode.procedimentos.map(proc => {
                                        const changesForProc = procedureChanges[proc.id] || {};
                                        return (
                                            <GlassCard key={proc.id} className="p-4 shadow-md">
                                                <div className="flex justify-between items-start mb-3">
                                                    {editingNameId === proc.id ? (
                                                        <div className="flex items-center gap-2 flex-1 mr-2">
                                                            <input
                                                                type="text"
                                                                value={tempName}
                                                                onChange={(e) => setTempName(e.target.value)}
                                                                className="flex-1 bg-white dark:bg-zinc-800 border border-blue-500 rounded px-2 py-1 text-sm font-semibold outline-none"
                                                                autoFocus
                                                            />
                                                            <button onClick={() => handleSaveName(proc.id)} className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"><Check size={16} /></button>
                                                            <button onClick={handleCancelEditName} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><X size={16} /></button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 flex-1 mr-2 min-w-0 group">
                                                            <h4 className="font-semibold truncate">{proc.nome}</h4>
                                                            <button
                                                                onClick={() => handleStartEditName(proc)}
                                                                className="p-1 text-zinc-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="Editar nome"
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(proc.id)}
                                                                className="p-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="Excluir item"
                                                            >
                                                                {isDeletingId === proc.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                            </button>
                                                        </div>
                                                    )}
                                                    <SaveButton procId={proc.id} />
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {(Object.keys(priceTiers) as PriceTierKey[]).map(tier => {
                                                        const originalValue = proc[tier];
                                                        const currentValue = changesForProc[tier] ?? originalValue;
                                                        return (
                                                            <div key={tier}>
                                                                <label className="block text-xs font-bold uppercase text-zinc-400 mb-1 ml-1">{priceTiers[tier]}</label>
                                                                <div className="relative">
                                                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 text-sm">R$</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder={originalValue?.toFixed(2) ?? '0.00'}
                                                                        value={currentValue ?? ''}
                                                                        onChange={(e) => handlePriceChange(proc.id, tier, e.target.value)}
                                                                        className="w-full bg-white/50 dark:bg-zinc-800/80 border dark:border-white/10 rounded-lg py-2 pl-9 pr-3 focus:ring-2 focus:ring-blue-500/50 outline-none font-mono"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </GlassCard>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Creation Modal */}
            {isCreating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <GlassCard className="w-full max-w-md p-0 relative overflow-hidden border border-white/20 dark:border-white/10 shadow-2xl">
                        {/* Decorative Header Background */}
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 pointer-events-none" />

                        <div className="relative p-6">
                            <button
                                onClick={() => setIsCreating(false)}
                                className="absolute top-4 right-4 p-2 rounded-full bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 transition-colors backdrop-blur-sm"
                            >
                                <X size={18} className="text-zinc-500 dark:text-zinc-400" />
                            </button>

                            <div className="mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                                    <Plus size={24} className="text-white" />
                                </div>
                                <h2 className="text-2xl font-bold text-zinc-800 dark:text-white mb-1">Novo Item</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">Adicione um novo procedimento ao catálogo de serviços.</p>
                            </div>

                            <div className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-zinc-400 tracking-wider ml-1">Nome do Procedimento</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-blue-500 transition-colors">
                                            <Tag size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            value={newProcName}
                                            onChange={(e) => setNewProcName(e.target.value)}
                                            placeholder="Ex: Instalação de Câmera IP"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all font-medium text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-zinc-400 tracking-wider ml-1">Categoria</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-blue-500 transition-colors">
                                            <Layers size={18} />
                                        </div>
                                        <select
                                            value={newProcCategory}
                                            onChange={(e) => setNewProcCategory(Number(e.target.value))}
                                            className="w-full pl-10 pr-10 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all appearance-none font-medium text-zinc-700 dark:text-zinc-200 cursor-pointer"
                                        >
                                            <option value="">Selecione uma categoria...</option>
                                            {catalog.categorias.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.nome}</option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-400">
                                            <ChevronDown size={16} />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        onClick={handleCreateProcedure}
                                        disabled={!newProcName || !newProcCategory || isCreatingLoading}
                                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95 hover:scale-[1.02]"
                                    >
                                        {isCreatingLoading ? <Loader2 className="animate-spin" /> : <Plus size={20} strokeWidth={2.5} />}
                                        <span>Criar Procedimento</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            )}      </div>
    );
};