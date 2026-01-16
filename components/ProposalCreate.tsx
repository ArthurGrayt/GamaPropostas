import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import { CatalogContext, fetchCatalogData, createProposal, createNewClient, createProcedure, updateClientModality, createUnit } from '../services/mockData';
import { GlassCard, SearchBar, FilterPill, cn, ClientSelector } from './UIComponents';
import { ArrowLeft, Plus, Minus, Layers, List, Loader2, Save, X, ShoppingCart, Tag, Edit2, Check, X as XIcon, CalendarDays, CalendarPlus, ListTodo, CalendarClock, ChevronRight, Trash, Building2, User, FileText } from 'lucide-react';
import { TextImportModal } from './TextImportModal';
import { Modulo, Categoria, Procedimento, Client } from '../types';

interface Props {
  onBack: () => void;
  onSuccess: () => void;
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

type SelectedItemState = {
  quantity: number;
  priceTier: PriceTierKey;
  manualPrice?: number;
  addedAt?: number; // Timestamp for sorting
};

type CartSortOrder = 'RECENT' | 'AZ' | 'ZA';

type SummaryItem = {
  procedimento: Procedimento;
  quantity: number;
  priceTier: PriceTierKey;
  unitPrice: number;
  manualPrice?: number;
  addedAt?: number;
};


export const ProposalCreate: React.FC<Props> = ({ onBack, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catalog, setCatalog] = useState<CatalogContext>({ modulos: [], categorias: [], procedimentos: [], clientes: [], unidades: [] });
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [openPriceMenu, setOpenPriceMenu] = useState<number | null>(null);
  const priceMenuRef = useRef<HTMLDivElement>(null);
  const [openSidebarPriceMenu, setOpenSidebarPriceMenu] = useState<number | null>(null);
  const sidebarPriceMenuRef = useRef<HTMLDivElement>(null);
  const [openGlobalPriceMenu, setOpenGlobalPriceMenu] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [selectedItemsMap, setSelectedItemsMap] = useState<Record<number, SelectedItemState>>({});
  const [deliveryDates, setDeliveryDates] = useState<Record<number, string>>({});
  const [globalDeliveryDate, setGlobalDeliveryDate] = useState('');

  const [editingPrice, setEditingPrice] = useState<{ procId: number; price: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeModuloId, setActiveModuloId] = useState<number | 'ALL'>('ALL');
  const [activeCategoriaId, setActiveCategoriaId] = useState<number | 'ALL'>('ALL');

  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [modalTab, setModalTab] = useState<'client' | 'unit'>('client');
  const [newClientData, setNewClientData] = useState({ nomeFantasia: '', razaoSocial: '', email: '', phone: '', cnpj: '' });
  const [newUnitData, setNewUnitData] = useState({ name: '', companyId: '' });
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [isSavingNewClient, setIsSavingNewClient] = useState(false);
  const [isSavingNewUnit, setIsSavingNewUnit] = useState(false);

  // Client Modality Persistence
  const [showModalityConfirmation, setShowModalityConfirmation] = useState<{ show: boolean, newModality: PriceTierKey | null }>({ show: false, newModality: null });
  const [activeClientModality, setActiveClientModality] = useState<PriceTierKey>('preco_avulso');  // Default
  const [modalityMenuOpen, setModalityMenuOpen] = useState(false);

  // New Procedure State
  const [isCreatingProcedure, setIsCreatingProcedure] = useState(false);
  const [newProcedureData, setNewProcedureData] = useState({ name: '', categoryId: 0, moduleId: 0 });
  const [isSavingNewProcedure, setIsSavingNewProcedure] = useState(false);

  const [cartActiveTab, setCartActiveTab] = useState<'itens' | 'prazos'>('itens');
  const [cartSortOrder, setCartSortOrder] = useState<CartSortOrder>('RECENT');
  const [isTextImportOpen, setIsTextImportOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await fetchCatalogData();
      setCatalog(data);

      // Load persisted state if exists
      const savedState = localStorage.getItem('SECUREFLOW_CART_STATE');
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          // Only restore if we have items
          if (Object.keys(parsed.selectedItemsMap || {}).length > 0) {
            setSelectedItemsMap(parsed.selectedItemsMap);
            if (parsed.selectedClientId) setSelectedClientId(parsed.selectedClientId);
            if (parsed.selectedUnitId) setSelectedUnitId(parsed.selectedUnitId);
            if (parsed.deliveryDates) setDeliveryDates(parsed.deliveryDates);
            if (parsed.globalDeliveryDate) setGlobalDeliveryDate(parsed.globalDeliveryDate);

            // We don't set 'loading' to false here, we wait for catalog
          } else {
            // If no items, fallback to default behavior (select first client)
            if (data.clientes.length > 0) setSelectedClientId(String(data.clientes[0].id));
          }
        } catch (e) {
          console.error("Failed to parse saved cart state", e);
          if (data.unidades.length > 0) {
            setSelectedUnitId(data.unidades[0].id);
            setSelectedClientId(data.unidades[0].empresaid);
          }
        }
      } else {
        if (data.unidades.length > 0) {
          setSelectedUnitId(data.unidades[0].id);
          setSelectedClientId(data.unidades[0].empresaid);
        }
      }

      setLoading(false);
    };
    load();
  }, []);

  // Persistence Effect
  useEffect(() => {
    if (!loading) {
      const stateToSave = {
        selectedItemsMap,
        selectedClientId,
        selectedUnitId,
        deliveryDates,
        globalDeliveryDate,
        // We can also save clientName for the dashboard to verify
        clientName: catalog.clientes.find(c => String(c.id) === selectedClientId)?.nome || ''
      };
      localStorage.setItem('SECUREFLOW_CART_STATE', JSON.stringify(stateToSave));
    }
  }, [selectedItemsMap, selectedClientId, selectedUnitId, deliveryDates, globalDeliveryDate, loading, catalog.clientes]);

  const handleClearCart = () => {
    if (window.confirm("Tem certeza que deseja limpar o carrinho?")) {
      setSelectedItemsMap({});
      setDeliveryDates({});
      setGlobalDeliveryDate('');
      localStorage.removeItem('SECUREFLOW_CART_STATE');

      // Optionally reset client
      if (catalog.unidades.length > 0) {
        setSelectedUnitId(catalog.unidades[0].id);
        setSelectedClientId(catalog.unidades[0].empresaid);
      }
    }
  }


  // Handle Client Selection & Auto-Modality
  useEffect(() => {
    if (selectedClientId) {
      const client = catalog.clientes.find(c => String(c.id) === selectedClientId);
      if (client && client.modalidade) {
        // Auto-apply stored modality
        const storedModality = client.modalidade as PriceTierKey;
        if (priceTiers[storedModality]) {
          setActiveClientModality(storedModality);
        }
      }
    }
  }, [selectedClientId, catalog.clientes]);

  const handleManualModalityChange = (tier: PriceTierKey) => {
    setActiveClientModality(tier);
    setModalityMenuOpen(false);
    setShowModalityConfirmation({ show: true, newModality: tier });
  };

  const confirmModalityAssociation = async (persist: boolean) => {
    if (persist && showModalityConfirmation.newModality && selectedClientId) {
      await updateClientModality(selectedClientId, showModalityConfirmation.newModality);
      // Update local catalog to reflect change avoid re-fetch
      setCatalog(prev => ({
        ...prev,
        clientes: prev.clientes.map(c => String(c.id) === selectedClientId ? { ...c, modalidade: showModalityConfirmation.newModality! } : c)
      }));
    }
    setShowModalityConfirmation({ show: false, newModality: null });

    if (showModalityConfirmation.newModality) {
      handleApplyModeToAll(showModalityConfirmation.newModality);
    }
  };

  // Close price menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (priceMenuRef.current && !priceMenuRef.current.contains(event.target as Node)) {
        setOpenPriceMenu(null);
      }
      if (sidebarPriceMenuRef.current && !sidebarPriceMenuRef.current.contains(event.target as Node)) {
        setOpenSidebarPriceMenu(null);
      }
    };

    if (openPriceMenu !== null || openSidebarPriceMenu !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openPriceMenu, openSidebarPriceMenu]);

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

  const summaryItems = useMemo((): SummaryItem[] => {
    const items = Object.keys(selectedItemsMap).map((procIdStr): SummaryItem | null => {
      const procId = parseInt(procIdStr, 10);
      const state = selectedItemsMap[procId];
      const procedimento = catalog.procedimentos.find(p => p.id === procId);
      if (!procedimento || !state) return null;

      const unitPrice = state.manualPrice ?? (procedimento[state.priceTier] ?? procedimento.preco_avulso ?? 0);

      return {
        procedimento,
        quantity: state.quantity,
        priceTier: state.priceTier,
        unitPrice,
        manualPrice: state.manualPrice,
        addedAt: state.addedAt || 0 // Internal use for sorting
      };
    }).filter((i): i is SummaryItem => i !== null);

    // Apply Sorting
    return items.sort((a, b) => {
      if (cartSortOrder === 'AZ') {
        return a.procedimento.nome.localeCompare(b.procedimento.nome);
      } else if (cartSortOrder === 'ZA') {
        return b.procedimento.nome.localeCompare(a.procedimento.nome);
      } else {
        // RECENT (Default) - Newest first (descending addedAt)
        // If addedAt is missing (0), it goes to the bottom
        // If keys are numbers, they might be sequential? But we use addedAt.
        // Fallback to ID if addedAt is equal/missing to keep stability?
        // Actually, if addedAt is 0 (legacy), user wants "Selection Order". 
        // If we didn't track it before, we can't recover. But new items will have it.
        // Let's sort: Higher addedAt comes first.
        return (b.addedAt || 0) - (a.addedAt || 0);
      }
    });

  }, [selectedItemsMap, catalog.procedimentos, cartSortOrder]);

  const totalValue = useMemo(() => summaryItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0), [summaryItems]);

  const availableCategorias = useMemo(() => {
    if (activeModuloId === 'ALL') return [];
    return catalog.categorias.filter(c => c.idmodulo === activeModuloId);
  }, [catalog.categorias, activeModuloId]);

  const handleItemSelect = (procId: number) => {
    setSelectedItemsMap(prev => {
      const newState = { ...prev };
      if (newState[procId]) {
        newState[procId] = { ...newState[procId], quantity: newState[procId].quantity + 1 };
      } else {
        newState[procId] = {
          quantity: 1,
          priceTier: activeClientModality,
          addedAt: Date.now() // Track when it was selected
        };
      }
      return newState;
    });
  };

  const handleItemQuantityChange = (procId: number, change: number) => {
    setSelectedItemsMap(prev => {
      const newState = { ...prev };
      if (newState[procId]) {
        const newQuantity = newState[procId].quantity + change;
        if (newQuantity <= 0) {
          delete newState[procId];
        } else {
          newState[procId] = { ...newState[procId], quantity: newQuantity };
        }
      }
      return newState;
    });
  };

  const handlePriceTierSelect = (procId: number, tier: PriceTierKey, menu: 'main' | 'sidebar') => {
    const proc = catalog.procedimentos.find(p => p.id === procId);
    if (!proc) return;

    setSelectedItemsMap(prev => ({
      ...prev,
      [procId]: {
        ...(prev[procId] || { quantity: 1, priceTier: 'preco_avulso' }),
        priceTier: tier,
        manualPrice: undefined,
      }
    }));
    if (menu === 'main') setOpenPriceMenu(null);
    else setOpenSidebarPriceMenu(null);
  };

  const handleApplyModeToAll = (tier: PriceTierKey) => {
    setSelectedItemsMap(prev => {
      const newState: Record<number, SelectedItemState> = {};
      Object.keys(prev).forEach(key => {
        const procId = Number(key);
        newState[procId] = {
          ...prev[procId],
          priceTier: tier,
          manualPrice: undefined
        };
      });
      return newState;
    });
    setOpenGlobalPriceMenu(false);
  };

  const handleSaveManualPrice = () => {
    if (!editingPrice) return;
    const { procId, price } = editingPrice;
    const newPrice = price === '' ? undefined : parseFloat(price);

    setSelectedItemsMap(prev => ({
      ...prev,
      [procId]: {
        ...(prev[procId] || { quantity: 1, priceTier: 'preco_avulso' }),
        manualPrice: newPrice,
      }
    }));
    setEditingPrice(null);
  };

  const handleApplyGlobalDate = () => {
    if (!globalDeliveryDate) return;
    const newDates: Record<number, string> = {};
    Object.keys(selectedItemsMap).forEach(procId => {
      newDates[Number(procId)] = globalDeliveryDate;
    });
    setDeliveryDates(newDates);
  };

  const handleTextImport = (items: { procedureId: number; quantity: number }[]) => {
    setSelectedItemsMap(prev => {
      const newState = { ...prev };
      items.forEach(({ procedureId, quantity }) => {
        const currentQty = newState[procedureId]?.quantity || 0;
        newState[procedureId] = {
          quantity: currentQty + quantity,
          priceTier: activeClientModality,
          addedAt: Date.now()
        };
      });
      return newState;
    });
    setIsTextImportOpen(false);
  };

  const handleCreateProposal = async () => {
    if (!selectedClientId) {
      alert('Por favor, selecione um cliente.');
      return;
    }
    if (summaryItems.length === 0) {
      alert('Adicione pelo menos um item à proposta.');
      return;
    }

    setSubmitting(true);

    const itemsPayload = summaryItems.map(item => ({
      procedimentoId: item.procedimento.id,
      quantidade: item.quantity,
      preco: item.unitPrice,
    }));

    const success = await createProposal(selectedClientId, itemsPayload, selectedUnitId || undefined);

    if (success) {
      // Clear persistence on success
      localStorage.removeItem('SECUREFLOW_CART_STATE');
      onSuccess();
    } else {
      alert('Ocorreu um erro ao criar a proposta. Tente novamente.');
      setSubmitting(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClientData.nomeFantasia.trim() || !newClientData.razaoSocial.trim()) {
      alert('Nome Fantasia e Razão Social são obrigatórios.');
      return;
    }

    setIsSavingNewClient(true);
    // 1. Create Client
    const clientResult = await createNewClient(
      newClientData.nomeFantasia,
      newClientData.razaoSocial,
      newClientData.email,
      newClientData.phone,
      newClientData.cnpj,
      undefined
    );

    if (clientResult.success && clientResult.data) {
      // 2. Create Default Unit
      const unitResult = await createUnit(newClientData.nomeFantasia, clientResult.data.id); // Using Nome Fantasia as Unit Name default

      setIsSavingNewClient(false);

      if (unitResult.success && unitResult.data) {
        // Update catalog
        setCatalog(prev => ({
          ...prev,
          clientes: [...prev.clientes, clientResult.data!],
          unidades: [...prev.unidades, unitResult.data!]
        }));

        // Select the new unit
        setSelectedClientId(clientResult.data.id);
        setSelectedUnitId(unitResult.data.id);

        setIsCreatingClient(false);
        setNewClientData({ nomeFantasia: '', razaoSocial: '', email: '', phone: '', cnpj: '' });
      } else {
        alert('Erro ao criar unidade automática: ' + unitResult.error);
      }
    } else {
      setIsSavingNewClient(false);
      alert('Erro ao criar cliente: ' + clientResult.error);
    }
  };

  const handleCreateUnit = async () => {
    if (!newUnitData.name.trim()) {
      alert('O nome da unidade é obrigatório.');
      return;
    }
    if (!newUnitData.companyId) {
      alert('Selecione uma empresa.');
      return;
    }

    setIsSavingNewUnit(true);
    const result = await createUnit(newUnitData.name, newUnitData.companyId);
    setIsSavingNewUnit(false);

    if (result.success && result.data) {
      // Update catalog
      setCatalog(prev => ({
        ...prev,
        unidades: [...prev.unidades, result.data!]
      }));

      // Select the new unit
      setSelectedClientId(newUnitData.companyId);
      setSelectedUnitId(result.data.id);

      setIsCreatingClient(false);
      setNewUnitData({ name: '', companyId: '' });
      setCompanySearchQuery('');
    } else {
      alert('Erro ao criar unidade: ' + result.error);
    }
  };

  const filteredCompanies = useMemo(() => {
    if (!companySearchQuery) return catalog.clientes;
    const lower = companySearchQuery.toLowerCase();
    return catalog.clientes.filter(c =>
      c.nome.toLowerCase().includes(lower) ||
      (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(lower)) ||
      (c.razao_social && c.razao_social.toLowerCase().includes(lower))
    );
  }, [catalog.clientes, companySearchQuery]);

  const handleCreateProcedure = async () => {
    if (!newProcedureData.name.trim()) {
      alert('O nome do procedimento é obrigatório.');
      return;
    }
    if (!newProcedureData.categoryId) {
      alert('Selecione uma categoria.');
      return;
    }

    setIsSavingNewProcedure(true);
    const result = await createProcedure(newProcedureData.name, newProcedureData.categoryId);
    setIsSavingNewProcedure(false);

    if (result.success && result.data) {
      // Refresh catalog to include new procedure
      const data = await fetchCatalogData();
      setCatalog(data);

      setIsCreatingProcedure(false);
      setNewProcedureData({ name: '', categoryId: 0, moduleId: 0 });
    } else {
      alert('Erro ao criar procedimento: ' + result.error);
    }
  };

  const PriceMenu: React.FC<{ proc: Procedimento, menu: 'main' | 'sidebar' }> = ({ proc, menu }) => {
    const tiers = (Object.keys(priceTiers) as PriceTierKey[]).filter(key => proc[key] != null);
    return (
      <div ref={menu === 'main' ? priceMenuRef : sidebarPriceMenuRef} className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-2xl border dark:border-white/10 z-50 animate-fade-in p-1">
        {tiers.map(tier => (
          <button key={tier} onClick={() => handlePriceTierSelect(proc.id, tier, menu)} className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-blue-500 hover:text-white flex items-center justify-between gap-3 text-zinc-700 dark:text-zinc-200">
            <span>{priceTiers[tier]}</span>
            <span className="font-mono text-xs">{(proc[tier] || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </button>
        ))}
      </div>
    );
  }

  if (loading) {
    return (<div className="flex h-screen items-center justify-center text-zinc-500"><Loader2 className="animate-spin mr-2" /> Carregando catálogo...</div>);
  }

  return (
    <div className="animate-fade-in bg-stone-50 dark:bg-[#050505] h-screen flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="z-20 bg-stone-100/80 dark:bg-[#050505]/80 backdrop-blur-xl border-b border-neutral-200/50 dark:border-white/5 pb-4 px-4 pt-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800"><ArrowLeft /></button>
            <h1 className="text-xl font-bold">Nova Proposta</h1>
          </div>
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Abrir resumo da proposta"
          >
            <ShoppingCart className="text-zinc-700 dark:text-zinc-300" />
            {summaryItems.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold ring-2 ring-stone-100 dark:ring-[#050505]">
                {summaryItems.reduce((acc, item) => acc + item.quantity, 0)}
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 mb-3">
          <div className="w-full md:w-2/3 flex items-center gap-2">
            <ClientSelector
              clients={catalog.clientes}
              selectedUnitId={selectedUnitId}
              onSelect={(cid, uid) => { setSelectedClientId(cid); setSelectedUnitId(uid); }}
              onCreateNew={() => setIsCreatingClient(true)}
              className="flex-1"
            />
            <div className="relative z-20">
              <button
                onClick={() => setModalityMenuOpen(!modalityMenuOpen)}
                className="h-[52px] px-4 bg-zinc-100 dark:bg-zinc-800 border border-transparent dark:border-zinc-700 hover:border-blue-500 text-zinc-700 dark:text-zinc-300 rounded-xl flex flex-col items-start justify-center text-xs transition-all w-40"
                title="Alterar modalidade padrão do cliente"
              >
                <span className="text-[10px] uppercase text-zinc-400 font-bold tracking-wider">Modalidade</span>
                <span className="font-semibold text-sm truncate w-full text-left">{priceTiers[activeClientModality]}</span>
              </button>

              {modalityMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border dark:border-zinc-800 z-50 animate-fade-in overflow-hidden">
                  {Object.keys(priceTiers).map((key) => {
                    const tier = key as PriceTierKey;
                    return (
                      <button
                        key={tier}
                        onClick={() => handleManualModalityChange(tier)}
                        className={cn(
                          "w-full text-left text-sm px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 block text-zinc-700 dark:text-zinc-200 border-b border-zinc-100 dark:border-zinc-800 last:border-0",
                          activeClientModality === tier ? "bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 font-medium" : ""
                        )}
                      >
                        {priceTiers[tier]}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-1/3">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar procedimento..."
              className="flex-1"
            />
            <button
              onClick={() => setIsCreatingProcedure(true)}
              className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              title="Adicionar Novo Procedimento"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

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

      <main className="flex-1 overflow-y-auto pb-6">
        <div className="px-4 space-y-6 mt-4 pb-4">
          {!filteredTree.length && (<div className="text-center py-10 text-zinc-400"><p>Nenhum procedimento encontrado.</p></div>)}
          {filteredTree.map(node => (
            <div key={node.modulo.id} className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold uppercase text-sm tracking-wider sticky top-0 z-10 bg-stone-100/90 dark:bg-[#050505]/90 backdrop-blur-xl py-3 -mx-4 px-4 border-b border-neutral-200/50 dark:border-white/5"><Layers size={16} />{node.modulo.nome}</div>
              {node.categorias.map(catNode => (
                <div key={catNode.data.id} className="space-y-3">
                  <h3 className="text-sm font-semibold ml-2 flex items-center gap-2"><List size={14} /> {catNode.data.nome}</h3>
                  {catNode.procedimentos.map(proc => {
                    const selected = selectedItemsMap[proc.id];
                    const unitPrice = selected?.manualPrice ?? (proc[selected?.priceTier || 'preco_avulso'] ?? proc.preco_avulso ?? 0);

                    return (
                      <GlassCard key={proc.id} className={`p-4 shadow-md relative transition-all ${openPriceMenu === proc.id ? 'z-50' : 'z-0'}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1 pr-4">
                            <h4 className="font-semibold mb-2">{proc.nome}</h4>
                            <div className="flex items-center gap-2 relative">
                              <button onClick={() => setOpenPriceMenu(openPriceMenu === proc.id ? null : proc.id)} className="flex items-center gap-1.5 text-xs font-semibold py-1 px-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
                                <Tag size={12} />
                                <span>{selected?.manualPrice !== undefined ? 'Manual' : priceTiers[selected?.priceTier || 'preco_avulso']}</span>
                              </button>
                              <span className="font-mono text-sm text-zinc-700 dark:text-zinc-200 font-bold">{unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                              {openPriceMenu === proc.id && <PriceMenu proc={proc} menu="main" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {selected ? (
                              <>
                                <button onClick={() => handleItemQuantityChange(proc.id, -1)} className="p-2 rounded-full bg-zinc-200 dark:bg-zinc-700 hover:bg-red-200 dark:hover:bg-red-800 text-red-600"><Minus size={16} /></button>
                                <span className="w-8 text-center font-bold text-lg">{selected.quantity}</span>
                                <button onClick={() => handleItemQuantityChange(proc.id, 1)} className="p-2 rounded-full bg-zinc-200 dark:bg-zinc-700 hover:bg-green-200 dark:hover:bg-green-800 text-green-600"><Plus size={16} /></button>
                              </>
                            ) : (
                              <button onClick={() => handleItemSelect(proc.id)} className="px-4 py-2 rounded-lg bg-blue-500 text-white font-semibold text-sm">Adicionar</button>
                            )}
                          </div>
                        </div>
                      </GlassCard>
                    )
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>

      {isCartOpen && createPortal(
        <>
          <div onClick={() => setIsCartOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] animate-backdrop-fade-in"></div>
          <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-stone-50 dark:bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[9999] flex flex-col animate-cart-slide-in">
            <div className="p-4 border-b dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg"><ShoppingCart size={20} /></div>
                <div>
                  <h2 className="font-bold text-lg">Resumo da Proposta</h2>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 font-mono space-y-1">
                    <p><span className="text-zinc-400 font-normal">Unidade:</span> {catalog.unidades.find(u => u.id === selectedUnitId)?.nome_unidade || 'Unidade Selecionada'}</p>
                    <p><span className="text-zinc-400 font-normal">Cliente:</span> {catalog.clientes.find(c => String(c.id) === selectedClientId)?.nome || 'Cliente'}</p>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 font-mono">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800"><XIcon size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Itens ({summaryItems.length})</span>
                    <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-700"></div>
                    <select
                      value={cartSortOrder}
                      onChange={(e) => setCartSortOrder(e.target.value as CartSortOrder)}
                      className="text-xs bg-transparent border-none outline-none text-zinc-500 font-medium cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors"
                    >
                      <option value="RECENT">Mais Recentes</option>
                      <option value="AZ">A-Z</option>
                      <option value="ZA">Z-A</option>
                    </select>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setOpenGlobalPriceMenu(!openGlobalPriceMenu)}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 flex items-center gap-1"
                    >
                      <Tag size={12} /> Aplicar modalidade a todos
                    </button>
                    {openGlobalPriceMenu && (
                      <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border dark:border-white/10 z-50 animate-fade-in p-1">
                        {Object.keys(priceTiers).map((key) => {
                          const tier = key as PriceTierKey;
                          return (
                            <button
                              key={tier}
                              onClick={() => handleApplyModeToAll(tier)}
                              className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-blue-500 hover:text-white block text-zinc-700 dark:text-zinc-200"
                            >
                              {priceTiers[tier]}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {summaryItems.length === 0 && (
                  <div className="text-center py-8 flex flex-col items-center gap-3">
                    <p className="text-zinc-400">Nenhum item adicionado.</p>
                    <button
                      onClick={() => setIsTextImportOpen(true)}
                      className="text-blue-600 dark:text-blue-400 font-medium text-sm flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-4 py-2 rounded-xl transition-all"
                    >
                      <FileText size={16} /> Adicionar por texto
                    </button>
                  </div>
                )}
                {summaryItems.map(item => (
                  <div key={item.procedimento.id} className={`p-3 bg-white dark:bg-zinc-800/50 rounded-lg flex items-start gap-3 border dark:border-white/10 relative transition-all ${openSidebarPriceMenu === item.procedimento.id ? 'z-50' : 'z-0'}`}>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{item.procedimento.nome}</p>
                      <div className="flex items-center gap-2 mt-1 relative">
                        <button onClick={() => setOpenSidebarPriceMenu(openSidebarPriceMenu === item.procedimento.id ? null : item.procedimento.id)} className="flex items-center gap-1.5 text-xs font-semibold py-1 px-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
                          <Tag size={12} />
                          <span>{item.manualPrice !== undefined ? 'Manual' : priceTiers[item.priceTier]}</span>
                        </button>

                        {editingPrice?.procId === item.procedimento.id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editingPrice.price}
                            onChange={(e) => setEditingPrice({ procId: item.procedimento.id, price: e.target.value })}
                            onBlur={handleSaveManualPrice}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveManualPrice()}
                            className="w-24 text-sm bg-white/50 dark:bg-black/50 border dark:border-white/10 rounded-md py-0.5 px-1 font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                            autoFocus
                          />
                        ) : (
                          <span onClick={() => setEditingPrice({ procId: item.procedimento.id, price: item.unitPrice.toString() })} className="font-mono text-sm flex items-center gap-1 cursor-pointer">{item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} <Edit2 size={12} className="text-zinc-400" /></span>
                        )}
                        {openSidebarPriceMenu === item.procedimento.id && <PriceMenu proc={item.procedimento} menu="sidebar" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-stone-100 dark:bg-zinc-900 p-1 rounded-full">
                      <button onClick={() => handleItemQuantityChange(item.procedimento.id, -1)} className="p-1 rounded-full text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"><Minus size={14} /></button>
                      <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                      <button onClick={() => handleItemQuantityChange(item.procedimento.id, 1)} className="p-1 rounded-full text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"><Plus size={14} /></button>
                    </div>
                    <button onClick={() => handleItemQuantityChange(item.procedimento.id, -Infinity)} className="p-2 text-red-500"><XIcon size={16} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 mt-auto border-t border-white/20 dark:border-white/10">
              <button
                onClick={handleCreateProposal}
                disabled={submitting || summaryItems.length === 0 || !selectedClientId}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-semibold transition-all duration-200 active:scale-95 shadow-lg bg-blue-600/90 hover:bg-blue-500 text-white shadow-blue-500/30 disabled:bg-zinc-400 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    <span>Criar Proposta</span>
                  </>
                )}
              </button>
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleClearCart}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                  <Trash size={14} /> Limpar Carrinho
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      <TextImportModal
        isOpen={isTextImportOpen}
        onClose={() => setIsTextImportOpen(false)}
        onConfirm={handleTextImport}
        catalog={catalog}
      />

      {isCreatingClient && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-visible border border-zinc-200 dark:border-zinc-800 animate-scale-in flex flex-col max-h-[90vh] min-h-[600px]">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50 rounded-t-2xl">
              <h3 className="font-bold text-zinc-800 dark:text-white">Gerenciar Cadastro</h3>
              <button onClick={() => setIsCreatingClient(false)} className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500"><X size={18} /></button>
            </div>

            <div className="px-4 pt-4 flex gap-4 border-b border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setModalTab('client')}
                className={cn(
                  "flex-1 pb-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors",
                  modalTab === 'client' ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                )}
              >
                <User size={16} /> Novo Cliente
              </button>
              <button
                onClick={() => setModalTab('unit')}
                className={cn(
                  "flex-1 pb-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors",
                  modalTab === 'unit' ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                )}
              >
                <Building2 size={16} /> Nova Unidade
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {modalTab === 'client' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Nome Fantasia *</label>
                    <input
                      type="text"
                      value={newClientData.nomeFantasia}
                      onChange={e => setNewClientData({ ...newClientData, nomeFantasia: e.target.value })}
                      className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/50 outline-none"
                      placeholder="Nome Fantasia"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Razão Social *</label>
                    <input
                      type="text"
                      value={newClientData.razaoSocial}
                      onChange={e => setNewClientData({ ...newClientData, razaoSocial: e.target.value })}
                      className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/50 outline-none"
                      placeholder="Razão Social Ltda"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">CNPJ</label>
                    <input
                      type="text"
                      value={newClientData.cnpj}
                      onChange={e => setNewClientData({ ...newClientData, cnpj: e.target.value })}
                      className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/50 outline-none"
                      placeholder="00.000.000/0000-00"
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
                    disabled={isSavingNewClient || !newClientData.nomeFantasia.trim() || !newClientData.razaoSocial.trim()}
                    className="w-full py-3 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    {isSavingNewClient ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    Criar Cliente
                  </button>
                </>
              ) : (
                <>
                  <div className="relative">
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Empresa (Cliente) *</label>
                    <div
                      className="relative"
                    >
                      <input
                        type="text"
                        value={companySearchQuery || (catalog.clientes.find(c => String(c.id) === newUnitData.companyId)?.nome || '')}
                        onChange={(e) => {
                          setCompanySearchQuery(e.target.value);
                          setNewUnitData(prev => ({ ...prev, companyId: '' })); // Clear selection on type
                          setIsCompanyDropdownOpen(true);
                        }}
                        onFocus={() => setIsCompanyDropdownOpen(true)}
                        className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/50 outline-none pr-10"
                        placeholder="Buscar empresa..."
                      />
                      {newUnitData.companyId ? (
                        <button
                          onClick={() => {
                            setNewUnitData(prev => ({ ...prev, companyId: '' }));
                            setCompanySearchQuery('');
                            setIsCompanyDropdownOpen(true);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                        >
                          <X size={16} />
                        </button>
                      ) : (
                        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 rotate-90" size={16} />
                      )}

                      {isCompanyDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsCompanyDropdownOpen(false)}
                          ></div>
                          <div className="absolute top-full left-0 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-20">
                            {filteredCompanies.length === 0 ? (
                              <div className="p-3 text-center">
                                <p className="text-sm text-zinc-500 mb-2">Empresa não encontrada.</p>
                                <button
                                  onClick={() => {
                                    setNewClientData(prev => ({ ...prev, nomeFantasia: companySearchQuery }));
                                    setModalTab('client');
                                    setIsCompanyDropdownOpen(false);
                                  }}
                                  className="text-sm font-semibold text-blue-600 hover:underline"
                                >
                                  Criar Empresa Principal
                                </button>
                              </div>
                            ) : (
                              filteredCompanies.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => {
                                    setNewUnitData(prev => ({ ...prev, companyId: String(c.id) }));
                                    setCompanySearchQuery('');
                                    setIsCompanyDropdownOpen(false);
                                  }}
                                  className="w-full text-left p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm border-b last:border-0 border-zinc-100 dark:border-zinc-800"
                                >
                                  <div className="font-semibold">{c.nome_fantasia || c.nome}</div>
                                  <div className="text-xs text-zinc-500">{c.razao_social}</div>
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Nome da Unidade *</label>
                    <input
                      type="text"
                      value={newUnitData.name}
                      onChange={e => setNewUnitData({ ...newUnitData, name: e.target.value })}
                      className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/50 outline-none"
                      placeholder="Ex: Matriz, Filial SP..."
                    />
                  </div>

                  <button
                    onClick={handleCreateUnit}
                    disabled={isSavingNewUnit || !newUnitData.name.trim() || !newUnitData.companyId}
                    className="w-full py-3 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    {isSavingNewUnit ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    Criar Unidade
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isCreatingProcedure && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-scale-in">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
              <h3 className="font-bold text-zinc-800 dark:text-white">Novo Procedimento</h3>
              <button onClick={() => setIsCreatingProcedure(false)} className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Nome *</label>
                <input
                  type="text"
                  value={newProcedureData.name}
                  onChange={e => setNewProcedureData({ ...newProcedureData, name: e.target.value })}
                  className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/50 outline-none"
                  placeholder="Nome do Procedimento"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Módulo</label>
                <select
                  value={newProcedureData.moduleId}
                  onChange={e => setNewProcedureData({ ...newProcedureData, moduleId: Number(e.target.value), categoryId: 0 })}
                  className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none"
                >
                  <option value={0}>Selecione um módulo</option>
                  {catalog.modulos.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Categoria *</label>
                <select
                  value={newProcedureData.categoryId}
                  onChange={e => setNewProcedureData({ ...newProcedureData, categoryId: Number(e.target.value) })}
                  disabled={!newProcedureData.moduleId}
                  className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none disabled:opacity-50"
                >
                  <option value={0}>Selecione uma categoria</option>
                  {catalog.categorias
                    .filter(c => c.idmodulo === newProcedureData.moduleId)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                </select>
              </div>
              <button
                onClick={handleCreateProcedure}
                disabled={isSavingNewProcedure || !newProcedureData.name.trim() || !newProcedureData.categoryId}
                className="w-full py-3 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {isSavingNewProcedure ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                Criar Procedimento
              </button>
            </div>
          </div>
        </div>
      )
      }

      {showModalityConfirmation.show && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-scale-in">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto mb-4">
                <Tag size={24} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Salvar Preferência?</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                Deseja associar esse cliente a essa modalidade <strong>({showModalityConfirmation.newModality ? priceTiers[showModalityConfirmation.newModality] : ''})</strong> permanentemente?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => confirmModalityAssociation(false)}
                  className="flex-1 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Apenas Agora
                </button>
                <button
                  onClick={() => confirmModalityAssociation(true)}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-colors"
                >
                  Sim, Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};