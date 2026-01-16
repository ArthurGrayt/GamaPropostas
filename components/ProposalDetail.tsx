
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EnrichedProposal, EnrichedItem, ProposalStatus, ItemStatus, Modulo, Categoria, Procedimento, DocSeg } from '../types';
import { GlassCard, StatusBadge, ActionButton, Avatar, SearchBar, FilterPill, ClientSelector, cn } from './UIComponents';
import { ArrowLeft, Box, CheckCircle, XCircle, Clock, Package, ChevronDown, AlertCircle, Trophy, Filter, Circle, PlayCircle, Eye, Send, UserCheck, MoreHorizontal, Edit2, Check, X, Loader2, CalendarClock, CalendarCheck, FileText, Archive, Trash2, Plus, Layers, List, Tag, Minus, Pencil, Calendar, Info, Settings, Share2, Building2, User, ChevronRight } from 'lucide-react';
import { updateProposalStatus, updateItemStatus, updateItemDetails, deleteProposal, deleteItem, addItemToProposal, fetchCatalogData, CatalogContext, updateProposalClient, createNewClient, createDocSeg, createUnit } from '../services/mockData';
import { generateProposalPdf } from '../services/pdfGenerator';

interface Props {
    proposal: EnrichedProposal;
    onBack: () => void;
    onUpdate: () => void;
    pdfTexts: {
        intro: string;
        footer: string;
        headerTitle: string;
        proposalPrefix: string;
        tableHeaders: { col1: string; col2: string; col3: string };
        observationLabel: string;
        whoWeAreTitle?: string;
        whoWeAreText?: string;
        ourTeamTitle?: string;
        teamCol1Title?: string;
        teamCol1Text?: string;
        teamCol2Title?: string;
        teamCol2Text?: string;
        whyChooseTitle?: string;
        whyChooseText?: string;
        introExames?: string;
        introDocumentos?: string;
        introEsocial?: string;
        introTreinamentos?: string;
        introServicosSST?: string;
    };
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
    'PENDING': { label: 'Pendente', icon: Clock, color: 'text-zinc-500', progress: 0 },
    'APPROVED': { label: 'Aprovado', icon: CheckCircle, color: 'text-emerald-500', progress: 100 },
    'REJECTED': { label: 'Reprovado', icon: XCircle, color: 'text-red-500', progress: 100 },
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

export const ProposalDetail: React.FC<Props> = ({ proposal, onBack, onUpdate, pdfTexts }) => {
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

    // Observation Modal State
    const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
    const [observationItem, setObservationItem] = useState<EnrichedItem | null>(null);
    const [observationText, setObservationText] = useState('');
    const [isSavingObservation, setIsSavingObservation] = useState(false);


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

        // Intercept APPROVED status for Bulk Doc Seg
        if (newStatus === 'APPROVED') {
            // 1. Identify items that need DocSeg
            const eligibleItems = items.filter(item => {
                const isExcludedModule = item.modulo?.nome && (
                    item.modulo.nome.toLowerCase().includes('exames') ||
                    item.modulo.nome.toLowerCase().includes('esocial')
                );
                // We apply it even if already approved? Usually bulk action applies to current state
                // If item is already APPROVED, maybe we don't re-create.
                // Let's filter items that represent "Pending" or "Rejected" that would become approved.
                // OR simpler: check if they have a linked doc seg? We don't track that easily on FE.
                // Assumption: Bulk approve applies to all non-approved items OR all items.
                // Let's target items that are NOT excluded.
                return !isExcludedModule;
            });

            if (eligibleItems.length > 0 && proposal.unidade_id) {
                setBulkDocSegItems(eligibleItems);
                setDocSegPrazo(''); // Single deadline for all
                setDocSegObs('');
                setIsBulkDocSegModalOpen(true);
                return;
            }
        }

        setIsUpdating(true);
        await updateProposalStatus(proposal.id, newStatus);
        setCurrentStatus(newStatus);
        onUpdate();
        setIsUpdating(false);
    };

    const handleConfirmBulkDocSeg = async () => {
        if (bulkDocSegItems.length === 0) return;
        if (!docSegPrazo) {
            alert("Por favor, informe o prazo para os documentos.");
            return;
        }

        setIsSavingDocSeg(true);
        try {
            // Create Doc Seg for each item
            const creates = bulkDocSegItems.map(item => {
                const docSegData: DocSeg = {
                    mes: new Date().getMonth() + 1,
                    empresa: proposal.unidade_id!, // Creating logic guarantees this is present
                    doc: item.procedimento.id,
                    valor: item.total || item.preco || 0,
                    status: 'Pendente',
                    data_recebimento: new Date().toISOString(),
                    prazo: new Date(docSegPrazo).toISOString(),
                    data_entrega: new Date(docSegPrazo).toISOString(),
                    enviado: false,
                    obs: docSegObs
                };
                return createDocSeg(docSegData);
            });

            await Promise.all(creates);

            // Finally, update Proposal Status to APPROVED
            // This will also cascade update item statuses to APPROVED via the API logic if implemented there,
            // OR we might need to manually update them if the API `updateProposalStatus` doesn't do it all perfectly.
            // Our `updateProposalStatus` DOES cascade 'APPROVED' to all items.
            await updateProposalStatus(proposal.id, 'APPROVED');
            setCurrentStatus('APPROVED');

            setIsBulkDocSegModalOpen(false);
            onUpdate();
        } catch (error) {
            console.error("Error batch creating doc seg:", error);
            alert("Erro ao criar documentos em lote.");
        } finally {
            setIsSavingDocSeg(false);
            setBulkDocSegItems([]);
        }
    };

    // Doc Seg Modal State
    const [isDocSegModalOpen, setIsDocSegModalOpen] = useState(false);
    const [docSegItem, setDocSegItem] = useState<EnrichedItem | null>(null);
    const [docSegPrazo, setDocSegPrazo] = useState('');
    const [docSegObs, setDocSegObs] = useState('');
    const [isSavingDocSeg, setIsSavingDocSeg] = useState(false);

    // Bulk Doc Seg State
    const [isBulkDocSegModalOpen, setIsBulkDocSegModalOpen] = useState(false);
    const [bulkDocSegItems, setBulkDocSegItems] = useState<EnrichedItem[]>([]);

    // Hover Module State (for z-index/overflow handling)
    const [hoveredModuleId, setHoveredModuleId] = useState<number | null>(null);

    // Deadline Config Modal State
    const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
    const [globalDeadline, setGlobalDeadline] = useState('');
    const [itemDeadlines, setItemDeadlines] = useState<Record<number, string>>({});
    const [isSavingDeadlines, setIsSavingDeadlines] = useState(false);

    const openDeadlineModal = () => {
        // Initialize with existing deadlines
        const currentDeadlines: Record<number, string> = {};
        proposal.itens.forEach(item => {
            if (item.data_para_entrega) {
                // Formatting for input[type="date"] (YYYY-MM-DD)
                // Assuming stored as ISO string, take first 10 chars
                currentDeadlines[item.id] = item.data_para_entrega.split('T')[0];
            }
        });
        setItemDeadlines(currentDeadlines);
        setGlobalDeadline('');
        setIsDeadlineModalOpen(true);
    };

    const handleApplyGlobalDeadline = () => {
        if (!globalDeadline) return;
        const newDeadlines = { ...itemDeadlines };
        proposal.itens.forEach(item => {
            newDeadlines[item.id] = globalDeadline;
        });
        setItemDeadlines(newDeadlines);
    };

    const handleConfirmDeadlines = async () => {
        setIsSavingDeadlines(true);
        try {
            // Update all items with new deadlines
            const updates = proposal.itens.map(item => {
                const newDeadline = itemDeadlines[item.id];
                // Determine if changed.
                const current = item.data_para_entrega ? item.data_para_entrega.split('T')[0] : '';

                if (newDeadline && newDeadline !== current) {
                    return updateItemDetails(item.id, {
                        data_para_entrega: new Date(newDeadline).toISOString()
                    });
                }
                return Promise.resolve();
            });

            await Promise.all(updates);

            // Refresh Data
            onUpdate();

            // Close this modal and Open Share Modal
            setIsDeadlineModalOpen(false);
            setIsShareModalOpen(true);

        } catch (error) {
            console.error("Error saving deadlines:", error);
            alert("Erro ao salvar prazos.");
        } finally {
            setIsSavingDeadlines(false);
        }
    };

    const handleItemStatusUpdate = async (itemId: number, uiKey: string, newStatus: ItemStatus) => {
        setOpenStatusMenu(null);

        // Intercept APPROVED status to open Doc Seg Modal
        if (newStatus === 'APPROVED') {
            const item = items.find(i => i.id === itemId);
            if (item) {
                // Check if module is excluded from Doc Seg
                const isExcludedModule = item.modulo?.nome && (
                    item.modulo.nome.toLowerCase().includes('exames') ||
                    item.modulo.nome.toLowerCase().includes('esocial')
                );

                if (!isExcludedModule) {
                    setDocSegItem(item);
                    setDocSegPrazo('');
                    setDocSegObs('');
                    // Default deadline to 30 days from now? Or simple empty. User requested to insert.
                    setIsDocSegModalOpen(true);
                    return;
                }
            }
        }

        await updateItemStatus(itemId, newStatus);

        // Reverse Sync: If all items become the SAME status, update the proposal status
        if (['APPROVED', 'PENDING', 'REJECTED'].includes(newStatus)) {
            const allItemsSameStatus = items.every(i => {
                const effectiveStatus = (i.id === itemId) ? newStatus : i.status;
                return effectiveStatus === newStatus;
            });

            if (allItemsSameStatus && currentStatus !== newStatus) {
                await updateProposalStatus(proposal.id, newStatus as ProposalStatus);
                setCurrentStatus(newStatus as ProposalStatus);
            }
        }

        onUpdate(); // Full refresh to get data_entregue
    };

    const handleStartEditingItem = (item: EnrichedItem) => {
        setEditingItem({
            uiKey: item.uiKey,
            preco: (item.preco ?? 0).toString(),
            modalidade: item.modalidade || 'Avulso'
        });
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

    // PDF Generation State
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [configTab, setConfigTab] = useState<'NOMENCLATURA' | 'OBSERVACOES'>('NOMENCLATURA');
    const [pdfCompanyNameType, setPdfCompanyNameType] = useState<'NOME' | 'RAZAO_SOCIAL' | 'NOME_FANTASIA'>('NOME');
    const [pdfModuleObservations, setPdfModuleObservations] = useState<Record<string, string>>({});

    const [pdfShowItemObservations, setPdfShowItemObservations] = useState(false);



    // Share Modal State
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    // New Client/Unit Modal State
    const [modalTab, setModalTab] = useState<'client' | 'unit'>('client');
    const [newUnitData, setNewUnitData] = useState({ name: '', companyId: '' });
    const [companySearchQuery, setCompanySearchQuery] = useState('');
    const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
    const [isSavingNewUnit, setIsSavingNewUnit] = useState(false);

    const filteredCompanies = useMemo(() => {
        if (!companySearchQuery) return catalog.clientes;
        const lower = companySearchQuery.toLowerCase();
        return catalog.clientes.filter(c =>
            c.nome.toLowerCase().includes(lower) ||
            (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(lower)) ||
            (c.razao_social && c.razao_social.toLowerCase().includes(lower))
        );
    }, [catalog.clientes, companySearchQuery]);

    // Identify unique modules for the Observation tab
    // We match the module titles used in pdfGenerator manually or infer them?
    // pdfGenerator uses: EXAMES, DOCUMENTOS, eSOCIAL, TREINAMENTOS, SERVIÇOS SST
    const availableModules = ['EXAMES', 'DOCUMENTOS', 'eSOCIAL', 'TREINAMENTOS', 'SERVIÇOS SST'];

    const handleOpenConfigModal = () => {
        setIsConfigModalOpen(true);
    };

    const handleConfirmGeneratePdf = async () => {
        setIsGeneratingPdf(true);
        try {
            await generateProposalPdf(proposal, {
                companyNameType: pdfCompanyNameType,
                moduleObservations: pdfModuleObservations,
                showItemObservations: pdfShowItemObservations,
                customIntro: pdfTexts.intro,
                customFooter: pdfTexts.footer || undefined,
                customHeaderTitle: pdfTexts.headerTitle,
                customProposalPrefix: pdfTexts.proposalPrefix,
                customTableHeaders: pdfTexts.tableHeaders,
                customObservationLabel: pdfTexts.observationLabel,
                // Institutional
                whoWeAreTitle: pdfTexts.whoWeAreTitle,
                whoWeAreText: pdfTexts.whoWeAreText,
                ourTeamTitle: pdfTexts.ourTeamTitle,
                teamCol1Title: pdfTexts.teamCol1Title,
                teamCol1Text: pdfTexts.teamCol1Text,
                teamCol2Title: pdfTexts.teamCol2Title,
                teamCol2Text: pdfTexts.teamCol2Text,
                whyChooseTitle: pdfTexts.whyChooseTitle,
                whyChooseText: pdfTexts.whyChooseText,
                // Module Intros
                introExames: pdfTexts.introExames,
                introDocumentos: pdfTexts.introDocumentos,
                introEsocial: pdfTexts.introEsocial,
                introTreinamentos: pdfTexts.introTreinamentos,
                introServicosSST: pdfTexts.introServicosSST
            });
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

    const handleConfirmDocSeg = async (redirect: boolean) => {
        if (!docSegItem) return;
        if (!docSegPrazo) {
            alert("Por favor, informe o prazo.");
            return;
        }
        if (!proposal.unidade_id) {
            alert('A proposta precisa estar vinculada a uma unidade para gerar documentos.');
            return;
        }

        setIsSavingDocSeg(true);
        try {
            // Create Doc Seg Record
            const docSegData: DocSeg = {
                mes: new Date().getMonth() + 1,
                empresa: proposal.unidade_id,
                doc: docSegItem.procedimento.id,
                valor: docSegItem.total || docSegItem.preco || 0,
                status: 'Pendente',
                data_recebimento: new Date().toISOString(),
                prazo: new Date(docSegPrazo).toISOString(),
                data_entrega: new Date(docSegPrazo).toISOString(), // Defaulting delivery target to deadline
                enviado: false,
                obs: docSegObs
            };

            await createDocSeg(docSegData);

            // Update Item Status to APPROVED
            await updateItemStatus(docSegItem.id, 'APPROVED');

            // Trigger Reverse Sync Logic
            const newStatus = 'APPROVED';
            // We need to re-fetch items or simulate the change to check if all are approved
            // Since state might not correspond to latest DB, checking local items array (which is from props).
            // Ideally we should rely on onUpdate to refresh everything, but to start the "All Approved" sync we check here.

            // Simple check: if all OTHER items are already APPROVED, then this one makes it complete.
            const otherItems = items.filter(i => i.id !== docSegItem.id);
            const allOthersApproved = otherItems.every(i => i.status === 'APPROVED');

            if (allOthersApproved && currentStatus !== 'APPROVED') {
                await updateProposalStatus(proposal.id, 'APPROVED');
                setCurrentStatus('APPROVED');
            }

            setIsDocSegModalOpen(false);
            onUpdate();
        } catch (error) {
            console.error("Error creating doc seg:", error);
            alert("Erro ao criar documento de segurança. Verifique o console.");
        } finally {
            setIsSavingDocSeg(false);
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
    // ... (rest of the file remains same, targeting line for replacement)


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
                preco: newItemDetails.price
            }
        );
        setIsSavingNewItem(false);

        if (success) {
            setIsAddingItem(false);
            setSelectedProcedure(null);
            setNewItemDetails({ quantity: 1, price: 0, isManualPrice: false });
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
        // 1. Create Client
        const clientResult = await createNewClient(
            newClientData.name,
            newClientData.email,
            newClientData.phone,
            proposal.id // We still pass proposal ID to link it immediately if possible
        );

        if (clientResult.success && clientResult.data) {
            // 2. Create Default Unit (Copying logic from ProposalCreate to be consistent)
            // Use the client name (or fancy name if we had it separately, but here we just have name) as default unit name
            const unitResult = await createUnit(newClientData.name, clientResult.data.id);

            setIsSavingNewClient(false);

            if (unitResult.success && unitResult.data) {
                // Update catalog locally
                setCatalog(prev => ({
                    ...prev,
                    clientes: [...prev.clientes, clientResult.data!],
                    unidades: [...prev.unidades, unitResult.data!]
                }));

                // Select the new client AND unit
                setSelectedClientId(String(clientResult.data.id));
                // If we could select unit here we would, but ProposalDetail mainly tracks client. 
                // However, createNewClient (mock) might have auto-linked if we passed proposal.id.
                // Let's rely on onUpdate to refresh proposal data.

                // Close modal
                setIsCreatingClient(false);
                setNewClientData({ name: '', email: '', phone: '' });

                onUpdate();
                setIsEditingClient(false);
            } else {
                alert('Cliente criado, mas erro ao criar unidade automática: ' + unitResult.error);
                // Even if unit failed, client was created, so we might want to refresh
                onUpdate();
                setIsCreatingClient(false);
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

            // If the unit belongs to the CURRENTLY selected client, we might want to select it functionality-wise, 
            // but in this view we mostly just select Client. 
            // If the user created a unit for the *currently selected client*, it's good.
            if (newUnitData.companyId === selectedClientId) {
                // Good.
            } else {
                // If they created a unit for another client, maybe switch to that client?
                setSelectedClientId(newUnitData.companyId);
            }

            setIsCreatingClient(false);
            setNewUnitData({ name: '', companyId: '' });
            setCompanySearchQuery('');
            onUpdate();
        } else {
            alert('Erro ao criar unidade: ' + result.error);
        }
    };

    const toggleModule = (modId: number) => {
        setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
    };

    const handleOpenObservationModal = (item: EnrichedItem) => {
        setObservationItem(item);
        setObservationText(item.observacao || '');
        setIsObservationModalOpen(true);
    };

    const handleSaveObservation = async () => {
        if (!observationItem) return;

        setIsSavingObservation(true);
        await updateItemDetails(observationItem.id, {
            observacao: observationText
        });

        setIsObservationModalOpen(false);
        setObservationItem(null);
        setIsSavingObservation(false);
        onUpdate();
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
    const totalApproved = useMemo(() => {
        return items
            .filter(i => i.status === 'APPROVED')
            .reduce((acc, i) => acc + (i.total || (i.preco || 0) * (i.quantidade || 1)), 0);
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
                    <GlassCard className="flex flex-col items-center text-center py-10 relative group z-20">
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
                                <h2 className="text-xl font-bold text-zinc-800 dark:text-white mb-2">
                                    <span className="text-zinc-500 font-normal text-base mr-1">Cliente :</span>
                                    {proposal.cliente.nome || 'Cliente Desconhecido'}
                                </h2>
                                {proposal.unidade && (
                                    <h2 className="text-lg font-bold text-zinc-800 dark:text-white mb-1">
                                        <span className="text-zinc-500 font-normal text-base mr-1">Unidade :</span>
                                        {proposal.unidade.nome_unidade}
                                    </h2>
                                )}
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
                        <div className="w-full space-y-3 px-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5"><CheckCircle size={14} /> Total Aprovado</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{totalApproved.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="w-full h-px bg-neutral-100 dark:bg-white/5 border-dashed"></div>
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-500 font-medium">Valor Total</span>
                                <span className="font-bold text-zinc-900 dark:text-white text-lg">{(proposal.totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
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
                                        onClick={handleConfirmGeneratePdf}
                                    />
                                    <ActionButton
                                        label="Configurar PDF"
                                        variant="neutral"
                                        icon={<Settings size={18} />}
                                        onClick={handleOpenConfigModal}
                                    />
                                    <ActionButton
                                        label="Compartilhar Proposta"
                                        variant="neutral"
                                        icon={<Share2 size={18} />}
                                        onClick={openDeadlineModal}
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
                                )
                                }
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
                            <div
                                key={modId}
                                className="space-y-4"
                                onMouseEnter={() => setHoveredModuleId(modId)}
                                onMouseLeave={() => setHoveredModuleId(null)}
                            >
                                <div onClick={() => toggleModule(modId)} className="flex items-center justify-between cursor-pointer group select-none">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"><Box size={20} /></div>
                                        <h2 className="text-xl font-bold text-zinc-800 dark:text-white">{moduleData.nome}</h2>
                                    </div>
                                    <div className={`p-2 rounded-full bg-stone-100 dark:bg-zinc-800 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}><ChevronDown size={16} /></div>
                                </div>

                                <div className={`space-y-6 transition-all duration-500 ease-spring px-1 pb-4 ${openStatusMenu !== null || editingItem !== null || hoveredModuleId === modId ? 'overflow-visible' : 'overflow-hidden'} ${isExpanded ? 'opacity-100 max-h-[5000px]' : 'opacity-0 max-h-0'}`}>
                                    {Object.entries(moduleData.categorias).map(([catId, data]) => {
                                        const catData = data as CategoryGroup;
                                        return (
                                            <div key={catId} className="pl-4 md:pl-6 border-l-2 border-neutral-200 dark:border-zinc-800 ml-5">
                                                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-zinc-400"></span>{catData.nome}
                                                </h3>
                                                <div className="space-y-3">
                                                    {catData.itens.map(item => {
                                                        const statusInfo = ITEM_STATUSES[item.status] || ITEM_STATUSES['PENDING'];
                                                        const StatusIcon = statusInfo.icon;
                                                        const isEditing = editingItem?.uiKey === item.uiKey;
                                                        const isDelivered = item.status === 'APPROVED';


                                                        return (
                                                            <GlassCard
                                                                key={item.uiKey}
                                                                className={`p-4 flex items-center justify-between group hover:border-blue-300/50 dark:hover:border-blue-500/30 relative transition-all hover:z-[70] ${openStatusMenu === item.uiKey || isEditing ? 'z-[50]' : 'z-10'} ${isEditing ? 'border-blue-400/80 dark:border-blue-500/70 ring-2 ring-blue-500/20' : ''}`}
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
                                                                            {item.observacao && (
                                                                                <div className="mt-1 flex items-start gap-1 p-1.5 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-100 dark:border-yellow-900/40">
                                                                                    <FileText size={12} className="text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0" />
                                                                                    <p className="text-xs text-yellow-800 dark:text-yellow-200 leading-tight">{item.observacao}</p>
                                                                                </div>
                                                                            )}


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
                                                                            <button onClick={() => handleOpenObservationModal(item)} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500" title="Adicionar Observação">
                                                                                <Info size={14} />
                                                                            </button>
                                                                            <button onClick={() => handleDeleteItem(item.id)} className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-500 transition-colors">
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                            <div className="relative group/status">
                                                                                <button onClick={() => setOpenStatusMenu(openStatusMenu === item.uiKey ? null : item.uiKey)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors bg-white/50 dark:bg-black/50 border dark:border-white/10 ${statusInfo.color}`}>
                                                                                    <StatusIcon size={14} />
                                                                                    <span className="hidden sm:inline">{statusInfo.label}</span>
                                                                                    <MoreHorizontal size={14} className="ml-1 text-zinc-400" />
                                                                                </button>

                                                                                {item.status === 'REJECTED' && item.feedback && openStatusMenu !== item.uiKey && (
                                                                                    <div className="absolute bottom-full right-0 mb-2 w-max max-w-[250px] p-3 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 pointer-events-none opacity-0 group-hover/status:opacity-100 transition-all transform translate-y-2 group-hover/status:translate-y-0 z-[60] flex flex-col gap-1">
                                                                                        <p className="font-bold text-red-500 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                                                                                            <XCircle size={10} /> Motivo da Recusa
                                                                                        </p>
                                                                                        <p className="leading-snug italic font-medium">"{item.feedback}"</p>
                                                                                        <div className="absolute top-full right-6 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-zinc-200 dark:border-t-zinc-700"></div>
                                                                                    </div>
                                                                                )}

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
            </div >

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

                        <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                            {modalTab === 'client' ? (
                                <>
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
                                        + Criar Cliente e Unidade Padrão
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="relative">
                                        <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Empresa (Cliente) *</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={companySearchQuery || (catalog.clientes.find(c => String(c.id) === newUnitData.companyId)?.nome || '')}
                                                onChange={(e) => {
                                                    setCompanySearchQuery(e.target.value);
                                                    setNewUnitData(prev => ({ ...prev, companyId: '' }));
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
                                                    <div className="absolute top-full left-0 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-20 custom-scrollbar">
                                                        {filteredCompanies.length === 0 ? (
                                                            <div className="p-3 text-center">
                                                                <p className="text-sm text-zinc-500 mb-2">Empresa não encontrada.</p>
                                                                <button
                                                                    onClick={() => {
                                                                        // Switch to create client tab, setting name
                                                                        setNewClientData(prev => ({ ...prev, name: companySearchQuery }));
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
                                                                    {c.razao_social && <div className="text-xs text-zinc-500">{c.razao_social}</div>}
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



            {/* Doc Seg Modal (Individual) */}
            {
                isDocSegModalOpen && docSegItem && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-neutral-200 dark:border-white/10">
                            <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-zinc-800 dark:text-white">Gerar Documento de Segurança</h3>
                                <button onClick={() => setIsDocSegModalOpen(false)} className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    Para aprovar o item <span className="font-bold text-zinc-800 dark:text-white">{docSegItem.procedimento.nome}</span>, é necessário gerar o documento de segurança.
                                </p>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Prazo de Entrega</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                        <input
                                            type="date"
                                            value={docSegPrazo}
                                            onChange={(e) => setDocSegPrazo(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Observações</label>
                                    <textarea
                                        value={docSegObs}
                                        onChange={(e) => setDocSegObs(e.target.value)}
                                        placeholder="Observações adicionais..."
                                        className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all min-h-[100px] dark:text-white"
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-neutral-100 dark:border-white/5 flex justify-end gap-3 flex-wrap">
                                <button
                                    onClick={() => setIsDocSegModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors font-medium text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleConfirmDocSeg(false)}
                                    disabled={isSavingDocSeg}
                                    className="px-4 py-2 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white font-medium transition-colors disabled:opacity-50 text-sm"
                                >
                                    Confirmar e Aprovar
                                </button>
                                <button
                                    onClick={() => handleConfirmDocSeg(true)}
                                    disabled={isSavingDocSeg}
                                    className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg shadow-green-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 text-sm"
                                >
                                    {isSavingDocSeg ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                    Confirmar e ir para Gama Seg
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Observation Modal */}
            {
                isObservationModalOpen && observationItem && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-neutral-200 dark:border-white/10">
                            <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-zinc-800 dark:text-white">Observação do Item</h3>
                                <button onClick={() => setIsObservationModalOpen(false)} className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    Adicionar observação para <span className="font-bold text-zinc-800 dark:text-white">{observationItem.procedimento.nome}</span>.
                                </p>
                                <textarea
                                    value={observationText}
                                    onChange={(e) => setObservationText(e.target.value)}
                                    placeholder="Escreva sua observação aqui..."
                                    className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all min-h-[100px] dark:text-white"
                                    autoFocus
                                />
                            </div>
                            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-neutral-100 dark:border-white/5 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsObservationModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors font-medium text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveObservation}
                                    disabled={isSavingObservation}
                                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 text-sm"
                                >
                                    {isSavingObservation ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* PDF Config Modal */}
            {
                isConfigModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-neutral-200 dark:border-white/10 flex flex-col max-h-[90vh]">
                            <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center shrink-0">
                                <h3 className="font-bold text-lg text-zinc-800 dark:text-white">Configuração do Relatório PDF</h3>
                                <button onClick={() => setIsConfigModalOpen(false)} className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Tabs Header */}
                            <div className="flex border-b border-neutral-100 dark:border-white/5 shrink-0">
                                <button
                                    onClick={() => setConfigTab('NOMENCLATURA')}
                                    className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${configTab === 'NOMENCLATURA' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
                                >
                                    Nomenclatura da Empresa
                                    {configTab === 'NOMENCLATURA' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400"></div>}
                                </button>
                                <button
                                    onClick={() => setConfigTab('OBSERVACOES')}
                                    className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${configTab === 'OBSERVACOES' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
                                >
                                    Observações por Módulo
                                    {configTab === 'OBSERVACOES' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400"></div>}
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                                {configTab === 'NOMENCLATURA' && (
                                    <div className="space-y-6 animate-slide-in">
                                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-neutral-200 dark:border-zinc-700">
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={pdfShowItemObservations}
                                                    onChange={(e) => setPdfShowItemObservations(e.target.checked)}
                                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="font-medium text-zinc-700 dark:text-zinc-200">Exibir observações individuais dos itens</span>
                                            </label>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 ml-8">
                                                Se marcado, as observações adicionadas a cada item (clicando no ícone 'i') serão exibidas no PDF logo abaixo do nome do item.
                                            </p>
                                        </div>

                                        <div className="space-y-3">
                                            <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Nomenclatura da Empresa</h4>
                                            <label
                                                onClick={() => setPdfCompanyNameType('NOME')}
                                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${pdfCompanyNameType === 'NOME' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-sm' : 'border-neutral-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${pdfCompanyNameType === 'NOME' ? 'border-blue-600' : 'border-zinc-300'}`}>
                                                        {pdfCompanyNameType === 'NOME' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                                                    </div>
                                                    <span className="font-medium text-zinc-700 dark:text-zinc-200">Nome do Cliente</span>
                                                </div>
                                                <span className="text-xs text-zinc-400">{proposal.cliente.nome}</span>
                                            </label>

                                            <label
                                                onClick={() => setPdfCompanyNameType('RAZAO_SOCIAL')}
                                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${pdfCompanyNameType === 'RAZAO_SOCIAL' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-sm' : 'border-neutral-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${pdfCompanyNameType === 'RAZAO_SOCIAL' ? 'border-blue-600' : 'border-zinc-300'}`}>
                                                        {pdfCompanyNameType === 'RAZAO_SOCIAL' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-zinc-700 dark:text-zinc-200 leading-tight">Razão Social</span>
                                                        <span className="text-[10px] text-zinc-400">
                                                            {proposal.unidade ? '(Unidade)' : '(Cliente)'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="text-xs text-zinc-400 truncate max-w-[150px]">
                                                    {proposal.unidade?.razao_social || proposal.cliente.razao_social || 'Não informado'}
                                                </span>
                                            </label>

                                            <label
                                                onClick={() => setPdfCompanyNameType('NOME_FANTASIA')}
                                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${pdfCompanyNameType === 'NOME_FANTASIA' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-sm' : 'border-neutral-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${pdfCompanyNameType === 'NOME_FANTASIA' ? 'border-blue-600' : 'border-zinc-300'}`}>
                                                        {pdfCompanyNameType === 'NOME_FANTASIA' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-zinc-700 dark:text-zinc-200 leading-tight">Nome Fantasia</span>
                                                        <span className="text-[10px] text-zinc-400">
                                                            {proposal.unidade ? '(Unidade)' : '(Cliente)'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="text-xs text-zinc-400 truncate max-w-[150px]">
                                                    {proposal.unidade?.nome_fantasia || proposal.cliente.nome_fantasia || 'Não informado'}
                                                </span>
                                            </label>
                                        </div>

                                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700/30 flex gap-3">
                                            <FileText className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={18} />
                                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                                Itens marcados como <span className="font-bold">Pendente</span> e <span className="font-bold">Aprovado</span> serão incluídos no PDF.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {configTab === 'OBSERVACOES' && (
                                    <div className="space-y-6 animate-slide-in">
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                            Adicione observações específicas para cada módulo que serão exibidas logo abaixo da tabela de itens correspondente no PDF gerado.
                                        </p>
                                        <div className="space-y-4">
                                            {availableModules.map(moduleTitle => (
                                                <div key={moduleTitle} className="space-y-1">
                                                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">{moduleTitle}</label>
                                                    <textarea
                                                        value={pdfModuleObservations[moduleTitle] || ''}
                                                        onChange={(e) => setPdfModuleObservations(prev => ({ ...prev, [moduleTitle]: e.target.value }))}
                                                        placeholder={`Observação para ${moduleTitle}...`}
                                                        className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all min-h-[80px] text-sm dark:text-white"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-neutral-100 dark:border-white/5 flex justify-end gap-3 shrink-0">
                                <button
                                    onClick={() => setIsConfigModalOpen(false)}
                                    className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                                >
                                    Salvar Configuração
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Deadline Configuration Modal */}
            {
                isDeadlineModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in border border-neutral-100 dark:border-zinc-800 flex flex-col max-h-[90vh]">
                            <div className="p-4 border-b border-neutral-100 dark:border-zinc-800 flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                                        <CalendarClock className="text-blue-500" size={20} />
                                        Configurar Prazos de Entrega
                                    </h3>
                                    <p className="text-xs text-zinc-500">Defina os prazos de entrega antes de compartilhar.</p>
                                </div>
                                <button onClick={() => setIsDeadlineModalOpen(false)} className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-b border-neutral-100 dark:border-zinc-800 shrink-0">
                                <label className="text-xs font-bold uppercase text-zinc-500 mb-1.5 block">Aplicar Prazo Geral</label>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={globalDeadline}
                                        onChange={(e) => setGlobalDeadline(e.target.value)}
                                        className="flex-1 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                                    />
                                    <button
                                        onClick={handleApplyGlobalDeadline}
                                        className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold text-sm rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                    >
                                        Aplicar a Todos
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {proposal.itens.map((item) => (
                                    <div key={item.uiKey} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                                        <div className="flex-1 pr-4">
                                            <p className="font-medium text-sm text-zinc-800 dark:text-zinc-200">{item.procedimento.nome}</p>
                                            <p className="text-xs text-zinc-500">{item.modulo.nome}</p>
                                        </div>
                                        <div className="w-40">
                                            <input
                                                type="date"
                                                value={itemDeadlines[item.id] || ''}
                                                onChange={(e) => setItemDeadlines(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                className={`w-full p-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${!itemDeadlines[item.id] ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'}`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 border-t border-neutral-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 shrink-0">
                                <button
                                    onClick={() => setIsDeadlineModalOpen(false)}
                                    className="px-6 py-2.5 rounded-xl text-zinc-600 dark:text-zinc-400 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmDeadlines}
                                    disabled={isSavingDeadlines}
                                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSavingDeadlines ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                                    Confirmar e Compartilhar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Share Modal */}
            {
                isShareModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-neutral-100 dark:border-zinc-800">
                            <div className="p-4 border-b border-neutral-100 dark:border-zinc-800 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Compartilhar Proposta</h3>
                                <button onClick={() => setIsShareModalOpen(false)} className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    Utilize o link abaixo para compartilhar esta proposta com seu cliente. Ele poderá visualizar, aprovar ou reprovar itens sem precisar de login.
                                </p>

                                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 break-all text-sm font-mono text-zinc-600 dark:text-zinc-300 select-all">
                                    {`${window.location.origin}${window.location.pathname}?mode=shared&id=${proposal.id}`}
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => {
                                            const url = `${window.location.origin}${window.location.pathname}?mode=shared&id=${proposal.id}`;
                                            navigator.clipboard.writeText(url);
                                            alert("Link copiado!");
                                            setIsShareModalOpen(false);
                                        }}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Check size={18} />
                                        Copiar
                                    </button>
                                    <button
                                        onClick={() => {
                                            const url = `${window.location.origin}${window.location.pathname}?mode=shared&id=${proposal.id}`;
                                            window.open(url, '_blank');
                                            setIsShareModalOpen(false);
                                        }}
                                        className="flex-1 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Share2 size={18} />
                                        Abrir Guia
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                )
            }
            {
                isBulkDocSegModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
                                <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                                    <Layers size={20} className="text-blue-500" />
                                    Aprovar Proposta
                                </h3>
                                <button onClick={() => setIsBulkDocSegModalOpen(false)} className="text-zinc-500 hover:text-red-500 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm border border-blue-200 dark:border-blue-800/50">
                                    <div className="font-semibold flex items-center gap-2 mb-1">
                                        <Info size={16} />
                                        Atenção
                                    </div>
                                    <p>
                                        Existem {bulkDocSegItems.length} itens elegíveis para geração de documentos (SST/Documentos).
                                        Defina o prazo abaixo para gerar os registros automaticamente.
                                    </p>
                                    <p className="mt-2 text-xs opacity-75">
                                        Itens de Exames e eSocial serão apenas aprovados, sem gerar documentos.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-2">
                                            <CalendarClock size={16} />
                                            Prazo de Entrega (Geral)
                                        </label>
                                        <input
                                            type="date"
                                            value={docSegPrazo}
                                            onChange={(e) => setDocSegPrazo(e.target.value)}
                                            className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-2">
                                            <FileText size={16} />
                                            Observações (Opcional)
                                        </label>
                                        <textarea
                                            value={docSegObs}
                                            onChange={(e) => setDocSegObs(e.target.value)}
                                            rows={3}
                                            className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                                            placeholder="Observações internas..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsBulkDocSegModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmBulkDocSeg}
                                    disabled={isSavingDocSeg}
                                    className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg shadow-blue-500/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0 flex items-center gap-2"
                                >
                                    {isSavingDocSeg ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Processando...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle size={16} />
                                            Aprovar Tudo e Gerar Docs
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
};