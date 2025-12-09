
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EnrichedProposal, EnrichedItem, ProposalStatus, ItemStatus, Modulo, Categoria, Procedimento } from '../types';
import { GlassCard, StatusBadge, ActionButton, Avatar, SearchBar, FilterPill, ClientSelector } from './UIComponents';
import { ArrowLeft, Box, CheckCircle, XCircle, Clock, Package, ChevronDown, AlertCircle, Trophy, Filter, Circle, PlayCircle, Eye, Send, UserCheck, MoreHorizontal, Edit2, Check, X, Loader2, CalendarClock, CalendarCheck, FileText, Archive, Trash2, Plus, Layers, List, Tag, Minus, Pencil } from 'lucide-react';
import { updateProposalStatus, updateItemStatus, updateItemDetails, deleteProposal, deleteItem, addItemToProposal, fetchCatalogData, CatalogContext, updateProposalClient, createNewClient } from '../services/mockData';
import { generateProposalPdf } from '../services/pdfGenerator';

interface Props {
    proposal: EnrichedProposal;
    onBack: () => void;
    onUpdate: () => void;
}

type PriceTierKey = 'preco_avulso' | 'preco_particular' | 'preco_parceiro' | 'preco_clientegama' | 'preco_premium';

const priceTiers: Record<PriceTierKey, string> = {
    preco_avulso: 'Avulso',
    preco_particular: 'Particular',
    preco_parceiro: 'Parceiro',
    preco_clientegama: 'Cliente Gama',
    preco_premium: 'Premium',
};

// --- Status Definitions ---
const ITEM_STATUSES: Record<ItemStatus, { label: string; icon: React.ElementType; color: string; progress: number; }> = {
    'NÃO INICIADO': { label: 'Não Iniciado', icon: Circle, color: 'text-zinc-500', progress: 0 },
    'EM PROCESSO': { label: 'Em Processo', icon: PlayCircle, color: 'text-blue-500', progress: 20 },
    'EM REVISÃO': { label: 'Em Revisão', icon: Eye, color: 'text-purple-500', progress: 40 },
    'ENVIADO AO CLIENTE': { label: 'Enviado', icon: Send, color: 'text-cyan-500', progress: 60 },
    'VALIDADO PELO CLIENTE': { label: 'Validado', icon: UserCheck, color: 'text-amber-500', progress: 80 },
    'PRONTO PARA COBRANÇA': { label: 'Pronto p/ Cobrança', icon: CheckCircle, color: 'text-emerald-500', progress: 100 },
};
const itemStatusKeys = Object.keys(ITEM_STATUSES) as ItemStatus[];

// Estruturas auxiliares para o agrupamento
type CategoryGroup = {
    nome: string;
    itens: EnrichedItem[];
};
type ModuleGroup = {
    nome: string;
    categorias: Record<number, CategoryGroup>;
};
type GroupedData = Record<number, ModuleGroup>;
type ItemStatusFilter = 'ALL' | ItemStatus;

export const ProposalDetail: React.FC<Props> = ({ proposal, onBack, onUpdate }) => {
    const [items, setItems] = useState<EnrichedItem[]>(proposal?.itens || []);
    const [currentStatus, setCurrentStatus] = useState<ProposalStatus>(proposal?.status || 'PENDING');
    const [isUpdating, setIsUpdating] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [activeItemFilter, setActiveItemFilter] = useState<ItemStatusFilter>('ALL');
    const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({});
    const [openStatusMenu, setOpenStatusMenu] = useState<string | null>(null);
    const statusMenuRef = useRef<HTMLDivElement>(null);

    const [editingItem, setEditingItem] = useState<{
        uiKey: string;
        preco: string;
        modalidade: string;
    } | null>(null);
    const [isSavingItem, setIsSavingItem] = useState(false);

    const [editingDate, setEditingDate] = useState<{ uiKey: string; date: string } | null>(null);
    const [isSavingDate, setIsSavingDate] = useState(false);

    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Add Item State
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [catalog, setCatalog] = useState<CatalogContext>({ modulos: [], categorias: [], procedimentos: [], clientes: [] });
    const [newItemSearch, setNewItemSearch] = useState('');
    const [selectedProcedure, setSelectedProcedure] = useState<Procedimento | null>(null);
    const [newItemDetails, setNewItemDetails] = useState({
        quantity: 1,
        price: 0,
        date: '',
        isManualPrice: false
    });
    const [isSavingNewItem, setIsSavingNewItem] = useState(false);

    // Edit Client State
    const [isEditingClient, setIsEditingClient] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState<string>(String(proposal.cliente.id));
    const [isSavingClient, setIsSavingClient] = useState(false);
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [newClientData, setNewClientData] = useState({ name: '', email: '', phone: '' });
    const [isSavingNewClient, setIsSavingNewClient] = useState(false);


    useEffect(() => {
        if (!proposal) return;
        setItems(proposal.itens || []);
        setCurrentStatus(proposal.status);
        setSelectedClientId(String(proposal.cliente.id));

        if (proposal.itens && Array.isArray(proposal.itens) && proposal.itens.length > 0) {
            const initialExpanded: Record<number, boolean> = {};
            proposal.itens.forEach(i => {
                if (i && i.modulo && i.modulo.id !== undefined) {
                    initialExpanded[i.modulo.id] = true;
                }
            });
            setExpandedModules(initialExpanded);
        }
    }, [proposal]);

    useEffect(() => {
        const loadCatalog = async () => {
            const data = await fetchCatalogData();
            setCatalog(data);
        };
        loadCatalog();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
                setOpenStatusMenu(null);
            }
        };
        if (openStatusMenu) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openStatusMenu]);

    const handleStatusChange = async (newStatus: ProposalStatus) => {
        if (!proposal) return;
        setIsUpdating(true);
        await updateProposalStatus(proposal.id, newStatus);
        setCurrentStatus(newStatus);
        onUpdate();
        setIsUpdating(false);
    };

    const handleItemStatusUpdate = async (itemId: number, uiKey: string, newStatus: ItemStatus) => {
        setOpenStatusMenu(null);
        await updateItemStatus(itemId, newStatus);
        onUpdate(); // Full refresh to get data_entregue
    };

    const handleStartEditingItem = (item: EnrichedItem) => {
        setEditingItem({
            uiKey: item.uiKey,
            preco: (item.preco ?? 0).toString(),
            modalidade: item.modalidade || 'Avulso'
        });
    };

    const handleSaveDateChange = async () => {
        if (!editingDate) return;

        const itemToUpdate = items.find(i => i.uiKey === editingDate.uiKey);
        if (!itemToUpdate) return;

        setIsSavingDate(true);
        await updateItemDetails(itemToUpdate.id, { data_para_entrega: editingDate.date });

        setEditingDate(null);
        setIsSavingDate(false);
        onUpdate(); // Refresh all data
    };

    const handleSaveItemChanges = async () => {
        if (!editingItem) return;

        const itemToUpdate = items.find(i => i.uiKey === editingItem.uiKey);
        if (!itemToUpdate) return;

        const newPrice = parseFloat(editingItem.preco);
        if (isNaN(newPrice) || newPrice < 0) {
            alert("Preço inválido.");
            return;
        }

        setIsSavingItem(true);
        await updateItemDetails(itemToUpdate.id, {
            preco: newPrice,
        });

        setEditingItem(null);
        setIsSavingItem(false);
        onUpdate(); // Refresh all data
    };

    const handleGeneratePdf = async () => {
        setIsGeneratingPdf(true);
        try {
            await generateProposalPdf(proposal);
        } catch (error) {
            console.error("PDF Generation Error: ", error);
            alert('Ocorreu um erro ao gerar o PDF.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleArchiveProposal = async () => {
        if (window.confirm('Tem certeza que deseja arquivar esta proposta? Ela será movida para uma seção separada.')) {
            await updateProposalStatus(proposal.id, 'ARCHIVED');
            onUpdate();
            onBack();
        }
    };

    const handleDeleteItem = async (itemId: number) => {
        if (window.confirm('Tem certeza que deseja remover este item da proposta?')) {
            const success = await deleteItem(proposal.id, itemId);
            if (success) {
                onUpdate();
            } else {
                alert('Falha ao remover o item. Tente novamente.');
            }
        }
    };

    const handleDeleteProposal = async () => {
        if (window.confirm('ATENÇÃO: Esta ação é irreversível e apagará a proposta permanentemente. Deseja continuar?')) {
            setIsDeleting(true);
            const result = await deleteProposal(proposal.id);
            setIsDeleting(false);

            if (result.success) {
                onUpdate();
                onBack();
            } else {
                alert(result.error || 'Falha ao apagar a proposta. Verifique o console para detalhes.');
            }
        }
    };


    const handleOpenAddItem = async () => {
        setIsAddingItem(true);
    };

    const handleAddItem = async () => {
        if (!selectedProcedure) return;

        setIsSavingNewItem(true);
        const success = await addItemToProposal(
            proposal.id,
            {
                procedimentoId: selectedProcedure.id,
                quantidade: newItemDetails.quantity,
                preco: newItemDetails.price,
                data_para_entrega: newItemDetails.date
            }
        );
        setIsSavingNewItem(false);

        if (success) {
            setIsAddingItem(false);
            setSelectedProcedure(null);
            setNewItemDetails({ quantity: 1, price: 0, date: '', isManualPrice: false });
            onUpdate();
        } else {
            alert('Erro ao adicionar item.');
        }
    };

    const handleSaveClientChange = async () => {
        if (!selectedClientId) return;
        setIsSavingClient(true);
        const success = await updateProposalClient(proposal.id, selectedClientId);
        setIsSavingClient(false);
        if (success.success) {
            setIsEditingClient(false);
            onUpdate();
        } else {
            alert('Erro ao atualizar cliente: ' + success.error);
        }
    };

    const handleCreateClient = async () => {
        if (!newClientData.name.trim()) {
            alert('O nome do cliente é obrigatório.');
            return;
        }

        setIsSavingNewClient(true);
        const result = await createNewClient(
            newClientData.name,
            newClientData.email,
            newClientData.phone,
            proposal.id
        );
        setIsSavingNewClient(false);

        if (result.success && result.data) {
            // Update catalog locally to include the new client immediately
            setCatalog(prev => ({
                ...prev,
                clientes: [...prev.clientes, result.data!]
            }));

            // Select the new client
            setSelectedClientId(String(result.data.id));

            // Close modal
            setIsCreatingClient(false);
            setNewClientData({ name: '', email: '', phone: '' });

            // Since createNewClient already linked the proposal, we can just refresh
            onUpdate();
            setIsEditingClient(false); // Exit edit mode as well since we're done
        } else {
            alert('Erro ao criar cliente: ' + result.error);
        }
    };

    const toggleModule = (modId: number) => {
        setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
    };

    const filteredItems = useMemo(() => {
        const safeItems = Array.isArray(items) ? items : [];
        return safeItems.filter(item => {
            const matchesSearch =
                (item.procedimento?.nome || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.modulo?.nome || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.categoria?.nome || '').toLowerCase().includes(searchQuery.toLowerCase());

            const matchesFilter = activeItemFilter === 'ALL' || item.status === activeItemFilter;

            return matchesSearch && matchesFilter;
        });
    }, [items, searchQuery, activeItemFilter]);

    const groupedItems = useMemo(() => {
        const groups: GroupedData = {};
        filteredItems.forEach(item => {
            if (!item || !item.modulo || item.modulo.id === undefined || !item.categoria || item.categoria.id === undefined || !item.procedimento) return;
            const modId = item.modulo.id;
            const catId = item.categoria.id;
            if (!groups[modId]) groups[modId] = { nome: item.modulo.nome || 'Módulo', categorias: {} };
            if (!groups[modId].categorias[catId]) groups[modId].categorias[catId] = { nome: item.categoria.nome || 'Categoria', itens: [] };
            groups[modId].categorias[catId].itens.push(item);
        });
        return groups;
    }, [filteredItems]);

    const progress = useMemo(() => {
        const totalItemsCount = Array.isArray(items) ? items.length : 0;
        if (totalItemsCount === 0) return 0;
        const totalProgress = items.reduce((acc, item) => {
            return acc + (ITEM_STATUSES[item.status]?.progress || 0);
        }, 0);
        return totalProgress / totalItemsCount;
    }, [items]);
    const isComplete = progress === 100;

    if (!proposal || !proposal.cliente) {
        return (
            <div className="p-8 text-center text-zinc-500">
                <AlertCircle className="mx-auto mb-4" />
                <p>Erro ao carregar dados da proposta.</p>
                <button onClick={onBack} className="mt-4 text-blue-500 underline">Voltar</button>
            </div>
        );
    }

    return (
        <div className="pb-24 animate-fade-in">
            <div className="mb-6 pt-2">
                <button onClick={onBack} className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors font-semibold">
                    <div className="w-8 h-8 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-md flex items-center justify-center"><ArrowLeft size={18} /></div>
                    Voltar
                </button>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white tracking-tight mb-1">Proposta #{proposal.id}</h1>
                        <p className="text-zinc-500 dark:text-zinc-400">{new Date(proposal.created_at).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className={`flex items-center gap-3 transition-opacity ${isUpdating ? 'opacity-50' : 'opacity-100'}`}><StatusBadge status={currentStatus} /></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-6 lg:col-span-1">
                    <GlassCard className="flex flex-col items-center text-center py-10 relative group">
                        {!isEditingClient ? (
                            <>
                                <button
                                    onClick={() => setIsEditingClient(true)}
                                    className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                    title="Alterar Cliente"
                                >
                                    <Pencil size={16} />
                                </button>
                                <div className="mb-4 relative">
                                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                                    <Avatar src={proposal.cliente.avatar || ''} alt={proposal.cliente.nome || 'Cliente'} />
                                </div>
                                <h2 className="text-xl font-bold text-zinc-800 dark:text-white mb-1">{proposal.cliente.nome || 'Cliente Desconhecido'}</h2>
                                {proposal.cliente.razao_social && proposal.cliente.razao_social !== proposal.cliente.nome && <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-1">{proposal.cliente.razao_social}</p>}
                                <p className="text-xs text-zinc-400 font-mono mt-1">{proposal.cliente.id !== 'unknown' ? 'Cliente Verificado' : 'Cliente Não Encontrado'}</p>
                            </>
                        ) : (
                            <div className="w-full px-4 animate-fade-in">
                                <h3 className="text-sm font-bold text-zinc-500 mb-3 uppercase tracking-wider">Selecionar Cliente</h3>
                                <ClientSelector
                                    clients={catalog.clientes}
                                    selectedClientId={selectedClientId}
                                    onSelect={setSelectedClientId}
                                    onCreateNew={() => setIsCreatingClient(true)}
                                    className="mb-4"
                                />
                                <div className="flex gap-2 justify-center">
                                    <button
                                        onClick={handleSaveClientChange}
                                        disabled={isSavingClient}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                    >
                                        {isSavingClient ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                        Salvar
                                    </button>
                                    <button
                                        onClick={() => setIsEditingClient(false)}
                                        className="flex items-center gap-2 px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium transition-colors"
                                    >
                                        <X size={16} />
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="w-full h-px bg-neutral-200 dark:bg-zinc-700/50 my-6"></div>
                        <div className="w-full flex justify-between px-4 mb-2">
                            <span className="text-zinc-500">Valor Total</span>
                            <span className="font-bold text-zinc-900 dark:text-white text-lg">{(proposal.totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    </GlassCard>
                    <GlassCard>
                        {!isAddingItem ? (
                            <>
                                <h3 className="text-sm font-bold uppercase text-zinc-400 tracking-wider mb-4">Ações</h3>
                                <div className="flex flex-col gap-3">
                                    <ActionButton label="Aprovada" variant={currentStatus === 'APPROVED' ? 'primary' : 'neutral'} icon={<CheckCircle size={18} />} onClick={() => handleStatusChange('APPROVED')} />
                                    <ActionButton label="Reprovada" variant={currentStatus === 'REJECTED' ? 'danger' : 'neutral'} icon={<XCircle size={18} />} onClick={() => handleStatusChange('REJECTED')} />
                                    <ActionButton label="Pendente" variant="neutral" icon={<Clock size={18} />} onClick={() => handleStatusChange('PENDING')} />

                                    <div className="w-full h-px bg-neutral-200 dark:bg-zinc-700/50 my-2"></div>

                                    <ActionButton label="Adicionar Item" variant="neutral" icon={<Plus size={18} />} onClick={handleOpenAddItem} />

                                    <ActionButton
                                        label={isGeneratingPdf ? 'Gerando...' : 'Gerar PDF'}
                                        variant="neutral"
                                        icon={isGeneratingPdf ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                                        onClick={handleGeneratePdf}
                                    />
                                    <ActionButton label="Arquivar Proposta" variant="neutral" icon={<Archive size={18} />} onClick={handleArchiveProposal} />
                                    <ActionButton
                                        label={isDeleting ? 'Apagando...' : 'Apagar Proposta'}
                                        variant="danger"
                                        icon={isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                        onClick={handleDeleteProposal}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="animate-fade-in">
                                <div className="flex justify-between items-center mb-4 border-b border-neutral-200 dark:border-white/10 pb-2">
                                    <h3 className="text-sm font-bold uppercase text-zinc-400 tracking-wider">Adicionar Item</h3>
                                    <button onClick={() => setIsAddingItem(false)} className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-500">
                                        <X size={16} />
                                    </button>
                                </div>

                                {!selectedProcedure ? (
                                    <div className="space-y-3">
                                        <SearchBar value={newItemSearch} onChange={setNewItemSearch} placeholder="Buscar..." className="w-full text-sm" />
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                            {catalog.procedimentos
                                                .filter(p => p.nome.toLowerCase().includes(newItemSearch.toLowerCase()))
                                                .slice(0, 20)
                                                .map(proc => (
                                                    <div
                                                        key={proc.id}
                                                        onClick={() => {
                                                            setSelectedProcedure(proc);
                                                            setNewItemDetails({
                                                                quantity: 1,
                                                                price: proc.preco_avulso || proc.preco || 0,
                                                                date: '',
                                                                isManualPrice: false
                                                            });
                                                        }}
                                                        className="p-2.5 rounded-lg border border-neutral-200 dark:border-white/5 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors flex justify-between items-center group"
                                                    >
                                                        <div className="flex-1 min-w-0 mr-2">
                                                            <span className="font-medium text-sm text-zinc-700 dark:text-zinc-200 block truncate">{proc.nome}</span>
                                                            <span className="text-xs text-zinc-500 font-mono">{(proc.preco_avulso || proc.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                        </div>
                                                        <Plus size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                ))
                                            }
                                            {catalog.procedimentos.length === 0 && <div className="text-center py-4 text-zinc-500 text-xs"><Loader2 className="animate-spin mx-auto mb-1" size={16} /> Carregando...</div>}
                                            {catalog.procedimentos.length > 0 && catalog.procedimentos.filter(p => p.nome.toLowerCase().includes(newItemSearch.toLowerCase())).length === 0 && (
                                                <div className="text-center py-4 text-zinc-400 text-xs">Nada encontrado.</div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 animate-slide-in">
                                        <button
                                            onClick={() => setSelectedProcedure(null)}
                                            className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors"
                                        >
                                            <ArrowLeft size={12} /> Voltar
                                        </button>

                                        <div className="bg-stone-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-neutral-200 dark:border-white/5">
                                            <h3 className="font-bold text-sm mb-0.5 text-zinc-900 dark:text-white leading-tight">{selectedProcedure.nome}</h3>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Quantidade</label>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setNewItemDetails(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))} className="p-1.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"><Minus size={14} /></button>
                                                    <input
                                                        type="number"
                                                        value={newItemDetails.quantity}
                                                        onChange={e => setNewItemDetails(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                                                        className="w-full text-center bg-transparent border-b border-zinc-200 dark:border-zinc-700 py-1 font-bold text-sm"
                                                    />
                                                    <button onClick={() => setNewItemDetails(prev => ({ ...prev, quantity: prev.quantity + 1 }))} className="p-1.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"><Plus size={14} /></button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Preço (R$)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={newItemDetails.price}
                                                    onChange={e => setNewItemDetails(prev => ({ ...prev, price: parseFloat(e.target.value) || 0, isManualPrice: true }))}
                                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-2 text-sm"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Entrega</label>
                                                <input
                                                    type="date"
                                                    value={newItemDetails.date}
                                                    onChange={e => setNewItemDetails(prev => ({ ...prev, date: e.target.value }))}
                                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-2 text-sm"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleAddItem}
                                            disabled={!selectedProcedure || isSavingNewItem}
                                            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm transition-all active:scale-95 mt-2"
                                        >
                                            {isSavingNewItem ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                                            <span>Adicionar</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </GlassCard>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="sticky top-6 z-30 transition-all duration-300">
                        <div className="bg-white/80 dark:bg-black/80 backdrop-blur-xl rounded-2xl p-5 flex items-center gap-5 border border-white/20 shadow-lg ring-1 ring-black/5">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md transition-colors duration-500 ${isComplete ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-blue-600 shadow-blue-500/20'}`}>
                                {isComplete ? <Trophy size={24} className="animate-pulse" /> : <Package size={24} />}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between text-sm font-bold mb-2">
                                    <span className="text-zinc-800 dark:text-white">{isComplete ? 'Entrega Concluída' : 'Progresso Geral'}</span>
                                    <span className={`${isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>{Math.round(progress)}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-stone-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-neutral-200 dark:border-zinc-700/50">
                                    <div className={`h-full transition-all duration-700 ease-out ${isComplete ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Buscar procedimento, categoria ou módulo..." className="w-full" />
                        <div className="flex gap-2 flex-wrap pb-2">
                            <FilterPill label="Todos" isActive={activeItemFilter === 'ALL'} onClick={() => setActiveItemFilter('ALL')} count={items.length} />
                            {itemStatusKeys.map(status => (
                                <FilterPill key={status} label={ITEM_STATUSES[status].label} isActive={activeItemFilter === status} onClick={() => setActiveItemFilter(status)} count={items.filter(i => i.status === status).length} />
                            ))}
                        </div>
                    </div>

                    {Object.keys(groupedItems).length === 0 && <div className="flex flex-col items-center justify-center py-12 text-zinc-500"><Filter size={48} className="mb-2 opacity-50" /><p>Nenhum item corresponde aos filtros.</p></div>}

                    {Object.entries(groupedItems).map(([modIdStr, data]) => {
                        const moduleData = data as ModuleGroup;
                        const modId = parseInt(modIdStr);
                        const forceExpand = searchQuery.length > 0 || activeItemFilter !== 'ALL';
                        const isExpanded = forceExpand ? true : expandedModules[modId];

                        return (
                            <div key={modId} className="space-y-4">
                                <div onClick={() => toggleModule(modId)} className="flex items-center justify-between cursor-pointer group select-none">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"><Box size={20} /></div>
                                        <h2 className="text-xl font-bold text-zinc-800 dark:text-white">{moduleData.nome}</h2>
                                    </div>
                                    <div className={`p-2 rounded-full bg-stone-100 dark:bg-zinc-800 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}><ChevronDown size={16} /></div>
                                </div>

                                <div className={`space-y-6 transition-all duration-500 ease-spring ${openStatusMenu !== null ? 'overflow-visible' : 'overflow-hidden'} ${isExpanded ? 'opacity-100 max-h-[5000px]' : 'opacity-0 max-h-0'}`}>
                                    {Object.entries(moduleData.categorias).map(([catId, data]) => {
                                        const catData = data as CategoryGroup;
                                        return (
                                            <div key={catId} className="pl-4 md:pl-6 border-l-2 border-neutral-200 dark:border-zinc-800 ml-5">
                                                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-zinc-400"></span>{catData.nome}
                                                </h3>
                                                <div className="space-y-3">
                                                    {catData.itens.map(item => {
                                                        const statusInfo = ITEM_STATUSES[item.status] || ITEM_STATUSES['NÃO INICIADO'];
                                                        const StatusIcon = statusInfo.icon;
                                                        const isEditing = editingItem?.uiKey === item.uiKey;
                                                        const isDelivered = item.status === 'VALIDADO PELO CLIENTE' || item.status === 'PRONTO PARA COBRANÇA';
                                                        const isOverdue = !isDelivered && item.data_para_entrega && new Date(item.data_para_entrega) < new Date();

                                                        return (
                                                            <GlassCard
                                                                key={item.uiKey}
                                                                className={`p-4 flex items-start justify-between group hover:border-blue-300/50 dark:hover:border-blue-500/30 relative transition-all ${openStatusMenu === item.uiKey ? 'z-20' : 'z-10'} ${isEditing ? 'border-blue-400/80 dark:border-blue-500/70 ring-2 ring-blue-500/20' : ''}`}
                                                            >
                                                                <div className="flex-1 pr-4">
                                                                    <h4 className="font-semibold text-zinc-800 dark:text-zinc-100 mb-1.5">{item.procedimento?.nome || 'Procedimento'}</h4>
                                                                    {isEditing ? (
                                                                        <div className="space-y-2 text-xs">
                                                                            <div className="flex items-center gap-2">
                                                                                <select
                                                                                    value={editingItem.modalidade}
                                                                                    onChange={(e) => {
                                                                                        const newModality = e.target.value;
                                                                                        const newTierKey = (Object.keys(priceTiers) as PriceTierKey[]).find(key => priceTiers[key] === newModality);
                                                                                        const newPrice = newTierKey ? (item.procedimento[newTierKey] ?? item.procedimento.preco_avulso) : parseFloat(editingItem.preco);
                                                                                        setEditingItem({
                                                                                            ...editingItem,
                                                                                            modalidade: newModality,
                                                                                            preco: (newPrice ?? 0).toString(),
                                                                                        });
                                                                                    }}
                                                                                    className="w-full text-xs bg-white/50 dark:bg-black/50 border dark:border-white/10 rounded-md p-1 focus:ring-1 focus:ring-blue-500 outline-none"
                                                                                >
                                                                                    {(Object.keys(priceTiers) as PriceTierKey[])
                                                                                        .filter(key => item.procedimento[key] != null)
                                                                                        .map(key => <option key={key} value={priceTiers[key]}>{priceTiers[key]}</option>)
                                                                                    }
                                                                                    <option value="Manual">Manual</option>
                                                                                </select>
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    value={editingItem.preco}
                                                                                    onChange={(e) => setEditingItem({ ...editingItem, preco: e.target.value, modalidade: 'Manual' })}
                                                                                    className="w-full text-xs bg-white/50 dark:bg-black/50 border dark:border-white/10 rounded-md p-1 font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                                                                                />
                                                                            </div>
                                                                            <p className="text-zinc-400 font-mono">Total: {(parseFloat(editingItem.preco || '0')).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="space-y-2">
                                                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-2 flex-wrap">
                                                                                <span className="font-sans font-bold text-zinc-600 dark:text-zinc-300">{(item.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                                                {item.modalidade && <span className="py-0.5 px-1.5 rounded bg-blue-100/70 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-sans font-semibold">{item.modalidade}</span>}
                                                                            </div>

                                                                            <div className="group/date relative">
                                                                                {editingDate?.uiKey === item.uiKey ? (
                                                                                    <div className="flex items-center gap-2 text-xs">
                                                                                        <input
                                                                                            type="date"
                                                                                            value={editingDate.date}
                                                                                            onChange={(e) => setEditingDate({ ...editingDate, date: e.target.value })}
                                                                                            className="w-full bg-white/50 dark:bg-black/50 border dark:border-white/10 rounded-md p-1 focus:ring-1 focus:ring-blue-500 outline-none"
                                                                                        />
                                                                                        <button onClick={handleSaveDateChange} disabled={isSavingDate} className="p-1.5 text-green-500 hover:bg-green-100 dark:hover:bg-green-900 rounded-full disabled:opacity-50">
                                                                                            {isSavingDate ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                                                        </button>
                                                                                        <button onClick={() => setEditingDate(null)} disabled={isSavingDate} className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full disabled:opacity-50">
                                                                                            <X size={14} />
                                                                                        </button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-center gap-2">
                                                                                        {isDelivered && item.data_entregue ? (
                                                                                            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                                                                                <CalendarCheck size={14} />
                                                                                                <span>Entregue em: {new Date(item.data_entregue).toLocaleDateString('pt-BR')}</span>
                                                                                            </div>
                                                                                        ) : item.data_para_entrega && (
                                                                                            <div className={`text-xs font-medium flex items-center gap-1.5 ${isOverdue ? 'text-red-500' : 'text-zinc-500'}`}>
                                                                                                {isOverdue ? <AlertCircle size={14} /> : <CalendarClock size={14} />}
                                                                                                <span>Prazo: {new Date(item.data_para_entrega).toLocaleDateString('pt-BR')}</span>
                                                                                            </div>
                                                                                        )}
                                                                                        {!isDelivered && (
                                                                                            <button
                                                                                                onClick={() => setEditingDate({ uiKey: item.uiKey, date: item.data_para_entrega?.split('T')[0] || '' })}
                                                                                                className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 opacity-0 group-hover/date:opacity-100 transition-opacity"
                                                                                            >
                                                                                                <Edit2 size={12} />
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="flex items-center gap-1">
                                                                    {isEditing ? (
                                                                        <>
                                                                            <button onClick={handleSaveItemChanges} disabled={isSavingItem} className="p-2 rounded-full text-green-600 hover:bg-green-100 dark:hover:bg-green-500/20 disabled:opacity-50">
                                                                                {isSavingItem ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                                            </button>
                                                                            <button onClick={() => setEditingItem(null)} disabled={isSavingItem} className="p-2 rounded-full text-red-600 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50">
                                                                                <X size={16} />
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <button onClick={() => handleStartEditingItem(item)} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500">
                                                                                <Edit2 size={14} />
                                                                            </button>
                                                                            <button onClick={() => handleDeleteItem(item.id)} className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-500 transition-colors">
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                            <div className="relative">
                                                                                <button onClick={() => setOpenStatusMenu(openStatusMenu === item.uiKey ? null : item.uiKey)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors bg-white/50 dark:bg-black/50 border dark:border-white/10 ${statusInfo.color}`}>
                                                                                    <StatusIcon size={14} />
                                                                                    <span className="hidden sm:inline">{statusInfo.label}</span>
                                                                                    <MoreHorizontal size={14} className="ml-1 text-zinc-400" />
                                                                                </button>
                                                                                {openStatusMenu === item.uiKey && (
                                                                                    <div ref={statusMenuRef} className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-2xl border dark:border-white/10 z-50 animate-fade-in p-1">
                                                                                        {itemStatusKeys.map(statusKey => {
                                                                                            const s = ITEM_STATUSES[statusKey];
                                                                                            const Icon = s.icon;
                                                                                            return (
                                                                                                <button key={statusKey} onClick={() => handleItemStatusUpdate(item.id, item.uiKey, statusKey)} className={`w-full text-left text-sm px-3 py-2 rounded-md hover:bg-blue-500 hover:text-white flex items-center gap-3 ${s.color}`}>
                                                                                                    <Icon size={16} /> <span>{s.label}</span>
                                                                                                </button>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </GlassCard>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {isCreatingClient && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-scale-in">
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
                            <h3 className="font-bold text-zinc-800 dark:text-white">Novo Cliente</h3>
                            <button onClick={() => setIsCreatingClient(false)} className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Nome *</label>
                                <input
                                    type="text"
                                    value={newClientData.name}
                                    onChange={e => setNewClientData({ ...newClientData, name: e.target.value })}
                                    className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    placeholder="Nome do Cliente ou Empresa"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Email</label>
                                <input
                                    type="email"
                                    value={newClientData.email}
                                    onChange={e => setNewClientData({ ...newClientData, email: e.target.value })}
                                    className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    placeholder="email@exemplo.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Telefone</label>
                                <input
                                    type="tel"
                                    value={newClientData.phone}
                                    onChange={e => setNewClientData({ ...newClientData, phone: e.target.value })}
                                    className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                            <button
                                onClick={handleCreateClient}
                                disabled={isSavingNewClient || !newClientData.name.trim()}
                                className="w-full py-3 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                {isSavingNewClient ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                Criar Cliente
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};