import React, { useState, useMemo, useEffect } from 'react';
import { EnrichedProposal, ProposalStatus, Client } from '../types';
import { GlassCard, Avatar, SearchBar, FilterPill, ClientSelector, cn } from './UIComponents';
import { ChevronRight, Calendar, DollarSign, CheckCircle, XCircle, Clock, Archive, Plus, FileText, Loader2, ListTodo, Copy } from 'lucide-react';
import { generateProposalPdf } from '../services/pdfGenerator';
import { getProposalById, fetchCatalogData, duplicateProposal } from '../services/mockData';


interface Props {
    proposals: EnrichedProposal[];
    onStatusChange: (id: number, newStatus: ProposalStatus) => void;
    onSelect: (id: number) => void;
    onCreate: () => void;
    pdfTexts: any;
    onNavigateToClients: () => void;
    onNavigateToSettings: () => void;
    onToggleTheme: () => void;
    onOpenPdfEditor: () => void;
    onSignOut: () => void;
    userEmail?: string;
    isDarkMode: boolean;
}

type FilterType = 'ALL' | ProposalStatus;

export const ProposalList: React.FC<Props> = ({
    proposals,
    onSelect,
    onStatusChange,
    onCreate,
    pdfTexts,
    onNavigateToClients,
    onNavigateToSettings,
    onToggleTheme,
    onOpenPdfEditor,
    onSignOut,
    userEmail,
    isDarkMode
}) => {

    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
    const [dateFilter, setDateFilter] = useState<{
        type: 'ALL' | 'DATE' | 'MONTH';
        value: string;
    }>({ type: 'ALL', value: '' });

    const [isGeneratingPdf, setIsGeneratingPdf] = useState<number | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<number | string | null>(null);

    // Persistence State
    const [savedProposal, setSavedProposal] = useState<{ clientName: string } | null>(null);

    useEffect(() => {
        const handleClickOutside = () => setActiveDropdown(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

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
                color: 'text-[#118b89] dark:text-[#118b89]',
                bg: 'bg-[#118b89]/5 hover:bg-[#118b89]/10',
                iconBg: 'bg-[#118b89]/20 dark:bg-[#118b89]/20 hover:bg-[#118b89]/30 dark:hover:bg-[#118b89]/30'
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
                await generateProposalPdf(fullProposal, {
                    companyNameType: 'NOME',
                    moduleObservations: {},
                    showItemObservations: false,
                    customIntro: pdfTexts.intro,
                    footer: pdfTexts.footer,
                    customHeaderTitle: pdfTexts.headerTitle,
                    customProposalPrefix: pdfTexts.proposalPrefix,
                    customTableHeaders: pdfTexts.tableHeaders,
                    customObservationLabel: pdfTexts.observationLabel,
                    // Dynamic Acceptance Link using current location
                    customAcceptanceLink: `${window.location.origin}${window.location.pathname}?mode=shared&id=${fullProposal.id}`,

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

                    // Images
                    customCoverUrl: pdfTexts.coverImage,
                    customBackgroundUrl: pdfTexts.backgroundImage,
                    customBackCoverUrl: pdfTexts.backCoverImage,

                    // Margins
                    customMargin: pdfTexts.margin,
                    customMarginTop: pdfTexts.marginTop,
                    customMarginBottom: pdfTexts.marginBottom,

                    // Intros
                    introExames: pdfTexts.introExames,
                    introDocumentos: pdfTexts.introDocumentos,
                    introEsocial: pdfTexts.introEsocial,
                    introTreinamentos: pdfTexts.introTreinamentos,
                    introServicosSST: pdfTexts.introServicosSST,
                    customModuleTitles: pdfTexts.customModuleTitles,
                    coverLinks: pdfTexts.coverLinks
                });
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


    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [duplicatingProposalId, setDuplicatingProposalId] = useState<number | null>(null);
    const [clients, setClients] = useState<Client[]>([]);
    const [targetClientId, setTargetClientId] = useState<string>('');
    const [targetUnitId, setTargetUnitId] = useState<number | null>(null);
    const [isDuplicating, setIsDuplicating] = useState(false);

    // Fetch clients for duplication modal
    useEffect(() => {
        const loadClients = async () => {
            const data = await fetchCatalogData();
            setClients(data.clientes);
        };
        loadClients();
    }, []);

    const handleDuplicateClick = (e: React.MouseEvent, proposalId: number) => {
        e.stopPropagation();
        setDuplicatingProposalId(proposalId);
        setIsDuplicateModalOpen(true);
        setTargetClientId('');
        setTargetUnitId(null);
    };

    const handleConfirmDuplicate = async () => {
        if (duplicatingProposalId && targetClientId) {
            setIsDuplicating(true);
            const success = await duplicateProposal(duplicatingProposalId, targetClientId, targetUnitId);
            setIsDuplicating(false);
            if (success) {
                setIsDuplicateModalOpen(false);
                setDuplicatingProposalId(null);
                setTargetClientId('');
                setTargetUnitId(null);
                // Trigger refresh by calling onStatusChange or similar if needed, 
                // but since we don't have a direct refresh prop, we might need to rely on parent refresh or reload.
                // Ideally, we should have an onRefresh prop.
                // For now, we can try to reload or just alert success.
                // Actually, ProposalList doesn't own the data, so it can't self-refesh easily without a callback.
                // Let's assume the user will see it on refresh or we can add an onDuplicateSuccess prop later.
                // Given the constraints, let's just close and maybe alert. 
                // Wait, `onCreate` is passed. Maybe we can misuse it? No.
                // Let's just reload the window for now as a quick fix or ask user to refresh? 
                // Better: The 'proposals' prop will update if we trigger a parent update. 
                // We don't have a way to trigger parent refresh.
                // Let's check App.tsx again. App.tsx passes `refreshData` to `ProposalDetail` but NOT to `ProposalList`.
                // I should add `onRefresh` to ProposalList props in a future step or now.
                // For now, I'll just reload the page to be safe and simple.
                window.location.reload();
            } else {
                alert('Erro ao duplicar proposta.');
            }
        } else {
            alert('Selecione um cliente para duplicar.');
        }
    };

    const getColorForClient = (name: string) => {
        return '#58AEAC';
    };

    return (
        <div className="space-y-6 pb-24 relative">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div>
                    <h1 className="text-[2.5rem] font-extrabold tracking-tight dark:text-white text-slate-900 leading-tight">Gama Propostas</h1>
                    <p className="text-lg text-slate-400 dark:text-slate-500 font-medium">Gestão de Segurança Corporativa</p>
                </div>
                <div className="flex items-center gap-4">
                    {userEmail && (
                        <div className="hidden md:flex flex-col items-end mr-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logado como</span>
                            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">{userEmail}</span>
                        </div>
                    )}

                    <button
                        onClick={onNavigateToClients}
                        className="w-11 h-11 rounded-2xl glass-panel bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:scale-110 active:scale-95 transition-all"
                        title="Gerenciar Clientes"
                    >
                        <span className="material-icons-round">person</span>
                    </button>

                    <button
                        onClick={onNavigateToSettings}
                        className="w-11 h-11 rounded-2xl glass-panel bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:scale-110 active:scale-95 transition-all"
                        title="Configurações"
                    >
                        <span className="material-icons-round text-xl">tune</span>
                    </button>

                    <button
                        onClick={onOpenPdfEditor}
                        className="w-11 h-11 rounded-2xl glass-panel bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:scale-110 active:scale-95 transition-all"
                        title="Editor de modelo padrão de PDF"
                    >
                        <span className="material-icons-round text-xl">description</span>
                    </button>

                    <button
                        onClick={onToggleTheme}
                        className="w-11 h-11 rounded-2xl glass-panel bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:scale-110 active:scale-95 transition-all"
                        title="Alternar Tema"
                    >
                        <span className={`material-icons-round text-xl ${!isDarkMode ? 'text-[#118b89]' : 'text-slate-400'}`}>
                            {isDarkMode ? 'dark_mode' : 'light_mode'}
                        </span>
                    </button>

                    <button
                        onClick={onSignOut}
                        className="w-11 h-11 rounded-2xl glass-panel bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:scale-110 active:scale-95 transition-all"
                        title="Sair"
                    >
                        <span className="material-icons-round text-xl">logout</span>
                    </button>
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

                <div className="flex flex-col lg:flex-row gap-4 items-center">
                    <div className="flex-grow w-full">
                        <SearchBar
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Buscar por cliente ou ID da proposta..."
                            className="w-full"
                        />
                    </div>

                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        {/* View Toggle */}
                        <div className="flex p-1.5 rounded-[1.5rem] glass-panel bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm h-[3.5rem] items-center">
                            <button
                                onClick={() => setViewMode('GRID')}
                                className={cn(
                                    "flex items-center justify-center w-12 h-11 rounded-2xl transition-all",
                                    viewMode === 'GRID'
                                        ? "bg-white dark:bg-white/10 shadow-sm text-charcoal dark:text-white"
                                        : "hover:bg-white/40 dark:hover:bg-white/5 text-slate-400"
                                )}
                            >
                                <span className="material-symbols-outlined fill-1">grid_view</span>
                            </button>
                            <button
                                onClick={() => setViewMode('LIST')}
                                className={cn(
                                    "flex items-center justify-center w-12 h-11 rounded-2xl transition-all",
                                    viewMode === 'LIST'
                                        ? "bg-white dark:bg-white/10 shadow-sm text-charcoal dark:text-white"
                                        : "hover:bg-white/40 dark:hover:bg-white/5 text-slate-400"
                                )}
                            >
                                <span className="material-symbols-outlined">view_list</span>
                            </button>
                        </div>

                        {/* Date Filter Selector */}
                        {/* Date Filter Selector */}
                        <div className="relative w-full lg:w-[280px] z-30">
                            {/* Main Reference Button */}
                            <div
                                className="w-full h-[3.5rem] rounded-[1.5rem] glass-panel bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between px-6 cursor-pointer hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm"
                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'DATE_FILTER' ? null : 'DATE_FILTER'); }}
                            >
                                <span className="text-slate-500 dark:text-slate-300 font-bold text-sm truncate mr-2">
                                    {dateFilter.type === 'ALL' ? 'Filtrar por data' :
                                        dateFilter.type === 'DATE' ? (dateFilter.value ? new Date(dateFilter.value).toLocaleDateString() : 'Selecionar dia') :
                                            (dateFilter.value ? dateFilter.value : 'Selecionar mês')}
                                </span>
                                {dateFilter.type !== 'ALL' ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setDateFilter({ type: 'ALL', value: '' }); }}
                                        className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-400"
                                    >
                                        <XCircle size={18} />
                                    </button>
                                ) : (
                                    <Calendar size={18} className="text-slate-300" />
                                )}
                            </div>

                            {/* Filter Dropdown Menu */}
                            {activeDropdown === 'DATE_FILTER' && (
                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute top-full right-0 mt-2 w-full min-w-[280px] bg-white dark:bg-zinc-900 shadow-2xl rounded-2xl border border-slate-100 dark:border-white/10 p-3 z-30 animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-2"
                                >
                                    <button
                                        onClick={() => setDateFilter({ type: 'DATE', value: '' })}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold",
                                            dateFilter.type === 'DATE' ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400"
                                        )}
                                    >
                                        <Calendar size={18} />
                                        Filtrar por dia
                                    </button>

                                    {dateFilter.type === 'DATE' && (
                                        <div className="px-4 pb-2 animate-in slide-in-from-top-2">
                                            <input
                                                type="date"
                                                value={dateFilter.value}
                                                onChange={(e) => setDateFilter({ type: 'DATE', value: e.target.value })}
                                                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-700 dark:text-slate-200"
                                            />
                                        </div>
                                    )}

                                    <button
                                        onClick={() => setDateFilter({ type: 'MONTH', value: '' })}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold",
                                            dateFilter.type === 'MONTH' ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400"
                                        )}
                                    >
                                        <Calendar size={18} />
                                        Filtrar por mês
                                    </button>

                                    {dateFilter.type === 'MONTH' && (
                                        <div className="px-4 pb-2 animate-in slide-in-from-top-2">
                                            <input
                                                type="month"
                                                value={dateFilter.value}
                                                onChange={(e) => setDateFilter({ type: 'MONTH', value: e.target.value })}
                                                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-700 dark:text-slate-200"
                                            />
                                        </div>
                                    )}

                                    <div className="h-px bg-slate-100 dark:bg-white/10 my-1"></div>

                                    <button
                                        onClick={() => { setDateFilter({ type: 'ALL', value: '' }); setActiveDropdown(null); }}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-all text-sm font-medium"
                                    >
                                        <XCircle size={18} />
                                        Limpar filtro
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 overflow-x-auto py-4 px-4 -mx-4 scrollbar-hide">
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
                </div>
            </section>

            {/* Grid or List of Cards */}
            {filteredProposals.length > 0 ? (
                viewMode === 'GRID' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {filteredProposals.map((prop) => {
                            const { icon: StatusIcon, color: statusColor, bg: statusBg, iconBg } = getStatusVisuals(prop.status);

                            return (
                                <GlassCard key={prop.id} onClick={() => onSelect(prop.id)} className="group relative overflow-hidden transition-all duration-300">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={`w-14 h-14 rounded-full flex items-center justify-center text-[#2D7A78] font-bold text-lg relative overflow-hidden`}
                                                style={{ backgroundColor: `${getColorForClient(prop.cliente.nome)}26` }}
                                            >
                                                {prop.cliente.nome.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-charcoal dark:text-white text-lg leading-tight uppercase truncate max-w-[120px]">
                                                    {prop.cliente.nome}
                                                </h3>
                                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">ID: #{prop.id}</span>
                                            </div>
                                        </div>
                                        <div
                                            role="button"
                                            onClick={(e) => handleIconClick(e, prop.id, prop.status)}
                                            className={`p-2 rounded-xl border transition-all ${prop.status === 'APPROVED' ? 'bg-green-50/50 dark:bg-green-900/20 border-green-100 dark:border-green-800' :
                                                prop.status === 'REJECTED' ? 'bg-rose-50/50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800' :
                                                    'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                                                }`}
                                        >
                                            <StatusIcon size={20} className={statusColor} />
                                        </div>
                                    </div>

                                    <div className="space-y-4 mb-8 pl-1">
                                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                                            <span className="material-icons-round text-sm opacity-50">calendar_today</span>
                                            <span className="text-sm font-medium">
                                                {new Date(prop.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-charcoal dark:text-slate-100">
                                            <span className="material-icons-round text-sm opacity-50">payments</span>
                                            <span className="text-xl font-extrabold tracking-tight">
                                                {prop.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-5 border-t border-slate-100 dark:border-white/5">
                                        <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em]">
                                            {prop.itens.length} {prop.itens.length === 1 ? 'item listado' : 'itens listados'}
                                        </span>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={(e) => handleDuplicateClick(e, prop.id)}
                                                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-400"
                                                title="Duplicar"
                                            >
                                                <span className="material-icons-round text-lg">content_copy</span>
                                            </button>
                                            <button
                                                onClick={(e) => handleGeneratePdf(e, prop.id)}
                                                disabled={isGeneratingPdf === prop.id}
                                                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-400"
                                                title="PDF"
                                            >
                                                {isGeneratingPdf === prop.id ? <Loader2 size={16} className="animate-spin" /> : <span className="material-symbols-outlined text-lg">description</span>}
                                            </button>
                                            <button className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-50 dark:bg-white/5 text-charcoal dark:text-slate-300 hover:scale-110 transition-transform">
                                                <span className="material-icons-round text-lg">chevron_right</span>
                                            </button>
                                        </div>
                                    </div>
                                </GlassCard>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {/* Table Header */}
                        <div className="grid grid-cols-[2fr,0.5fr,1.2fr,1.2fr,1fr,1fr,0.5fr] px-6 py-2 text-[10px] font-extrabold text-slate-400/80 dark:text-slate-500/80 uppercase tracking-[0.2em] items-center">
                            <div className="pl-4">Cliente</div>
                            <div className="text-center">ID</div>
                            <div className="text-center">Data</div>
                            <div className="text-center">Valor</div>
                            <div className="text-center">Itens</div>
                            <div className="text-center">Status</div>
                            <div className="text-right pr-6">Ações</div>
                        </div>

                        {filteredProposals.map((prop) => {
                            const { icon: StatusIcon, color: statusColor } = getStatusVisuals(prop.status);

                            return (
                                <GlassCard
                                    key={prop.id}
                                    onClick={() => onSelect(prop.id)}
                                    className={cn(
                                        "group grid grid-cols-[2fr,0.5fr,1.2fr,1.2fr,1fr,1fr,0.5fr] px-6 py-4 items-center gap-4 transition-all duration-300 hover:translate-x-1 border-transparent hover:border-slate-200 dark:hover:border-white/10 rounded-[1.5rem]",
                                        activeDropdown === prop.id ? "z-50 relative border-slate-200 dark:border-white/10" : "z-0"
                                    )}
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center text-[#2D7A78] font-bold text-xs relative overflow-hidden flex-shrink-0`}
                                            style={{ backgroundColor: `${getColorForClient(prop.cliente.nome)}26` }}
                                        >
                                            {prop.cliente.nome.substring(0, 2).toUpperCase()}
                                        </div>
                                        <h3 className="font-bold text-charcoal dark:text-slate-200 text-sm leading-tight uppercase truncate">
                                            {prop.cliente.nome}
                                        </h3>
                                    </div>

                                    <div className="text-center text-xs font-bold text-slate-400 dark:text-slate-500 tracking-tighter">
                                        #{prop.id}
                                    </div>

                                    <div className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        {new Date(prop.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </div>

                                    <div className="text-center font-extrabold text-charcoal dark:text-slate-100 tracking-tight text-base">
                                        {prop.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </div>

                                    <div className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                                        {prop.itens.length} {prop.itens.length === 1 ? 'item' : 'itens'}
                                    </div>

                                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                                        <div
                                            role="button"
                                            title="Clique para alterar o status"
                                            onClick={(e) => handleIconClick(e, prop.id, prop.status)}
                                            className={cn(
                                                "w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95",
                                                prop.status === 'APPROVED' ? 'text-green-500 bg-green-50/50 dark:bg-green-900/20' :
                                                    prop.status === 'REJECTED' ? 'text-rose-500 bg-rose-50/50 dark:bg-rose-900/20' :
                                                        'text-slate-300 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
                                            )}
                                        >
                                            {prop.status === 'APPROVED' ? (
                                                <span className="material-icons-round text-2xl">check_circle</span>
                                            ) : prop.status === 'REJECTED' ? (
                                                <span className="material-icons-round text-2xl">cancel</span>
                                            ) : (
                                                <span className="material-icons-round text-2xl">history</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-end pr-2">
                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === prop.id ? null : prop.id); }}
                                                className={cn(
                                                    "p-2 rounded-full transition-all",
                                                    activeDropdown === prop.id ? "bg-slate-100 dark:bg-white/10 text-charcoal dark:text-white" : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400"
                                                )}
                                            >
                                                <span className="material-icons-round text-2xl">more_vert</span>
                                            </button>

                                            {/* Action Dropdown Menu */}
                                            <div
                                                onClick={(e) => e.stopPropagation()}
                                                className={cn(
                                                    "absolute right-0 top-full mt-2 flex-col bg-white dark:bg-zinc-950 shadow-2xl rounded-2xl border border-slate-100 dark:border-white/10 p-2 z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 min-w-[140px]",
                                                    activeDropdown === prop.id ? "flex" : "hidden"
                                                )}
                                            >
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleDuplicateClick(e, prop.id); }}
                                                    className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors text-sm font-bold whitespace-nowrap"
                                                >
                                                    <span className="material-icons-round text-xl">content_copy</span>
                                                    Copiar
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleGeneratePdf(e, prop.id); }}
                                                    className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors text-sm font-bold whitespace-nowrap"
                                                >
                                                    <span className="material-symbols-outlined text-xl">description</span>
                                                    Gerar PDF
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </GlassCard>
                            );
                        })}
                    </div>
                )
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
            <div className="fixed bottom-10 right-10 z-50">
                <button
                    onClick={onCreate}
                    className="w-16 h-16 rounded-full bg-[#58AEAC] hover:bg-[#4C9C9A] active:bg-[#3A8583] flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.15)] hover:scale-110 active:scale-95 transition-all duration-300 relative group"
                    aria-label="Criar nova proposta"
                >
                    <span className="material-icons-round text-white text-3xl z-10">add</span>

                    <span className="absolute bottom-full mb-4 right-0 bg-zinc-900/80 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">
                        Nova Proposta
                    </span>
                </button>
            </div>

            {/* Duplicate Modal */}
            {isDuplicateModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 border dark:border-zinc-800">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold dark:text-white">Duplicar Proposta</h3>
                            <button onClick={() => setIsDuplicateModalOpen(false)} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Selecione o cliente e unidade para onde deseja copiar esta proposta.
                        </p>

                        <div className="space-y-4">
                            <ClientSelector
                                clients={clients}
                                selectedUnitId={targetUnitId}
                                onSelect={(cid, uid) => { setTargetClientId(cid); setTargetUnitId(uid); }}
                                onCreateNew={() => { }} // No creation in duplication mode for simplicity
                                className="w-full"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                onClick={() => setIsDuplicateModalOpen(false)}
                                className="px-4 py-2 text-zinc-600 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmDuplicate}
                                disabled={isDuplicating || !targetClientId}
                                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                            >
                                {isDuplicating && <Loader2 size={16} className="animate-spin" />}
                                Duplicar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};