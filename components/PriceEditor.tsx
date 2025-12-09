import React, { useState, useEffect, useMemo } from 'react';
import { CatalogContext, fetchCatalogData, updateProcedurePrice } from '../services/mockData';
import { GlassCard, SearchBar, FilterPill } from './UIComponents';
import { ArrowLeft, Layers, List, Loader2, Save, CheckCircle, AlertCircle } from 'lucide-react';
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
  
  const availableCategorias = useMemo(() => {
      if (activeModuloId === 'ALL') return [];
      return catalog.categorias.filter(c => c.idmodulo === activeModuloId);
  }, [catalog.categorias, activeModuloId]);

  const SaveButton: React.FC<{procId: number}> = ({ procId }) => {
    const status = savingState[procId] || 'idle';
    const hasChanges = !!procedureChanges[procId] && Object.keys(procedureChanges[procId]).length > 0;

    switch(status) {
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
        <div className="flex items-center gap-4 mb-4">
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800"><ArrowLeft /></button>
            <h1 className="text-xl font-bold">Editor de Preços</h1>
        </div>
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Buscar procedimento..." className="mb-3"/>
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
                                            <h4 className="font-semibold">{proc.nome}</h4>
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
    </div>
  );
};