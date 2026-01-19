import React, { useState, useEffect } from 'react';
import { ProposalList } from './components/ProposalList';
import { ProposalDetail } from './components/ProposalDetail';
import { ProposalCreate } from './components/ProposalCreate';
import { ClientManagement } from './components/ClientManagement';
import { PriceEditor } from './components/PriceEditor';
import { getProposals, getProposalById, updateProposalStatus } from './services/mockData';
import { EnrichedProposal, ProposalStatus } from './types';
import { Loader2, LogOut, User, SlidersHorizontal, Sun, Moon, FileText } from 'lucide-react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { LoginPage } from './components/LoginPage';
import { ClientProposalView } from './components/ClientProposalView';
import { PdfTextEditorModal } from './components/PdfTextEditorModal';

type ViewState = 'LIST' | 'DETAIL' | 'CREATE' | 'SETTINGS' | 'CLIENTS';

// Define defaults outside component to export/reuse if needed, or just keep stable
const DEFAULT_PDF_TEXTS = {
  intro: "A seguir, tem-se os valores dos principais exames que podem estar atrelados a algum cargo na empresa, não implicando na necessidade de contratação de todos eles, mas somente aqueles que forem necessários de acordo com o PCMSO da empresa.\n\nTodos os exames são realizados em nosso espaço da Clínica Gama Center, incluindo coleta de material para exames laboratoriais, exame toxicológico e outros exames complementares, com destaque ao Raio-X. Priorizamos a otimização atendimento a fim de se reduzir o tempo necessário para o trabalhador retornar à empresa.\n\nEstes são os valores dos principais exames que podem estar atrelados a algum cargo na empresa, não implicando na necessidade de contratação de todos eles, mas somente daqueles que forem demandados de acordo com o PCMSO da empresa.",
  footer: "Gama Center SST - 2025",
  headerTitle: "O que será feito :",
  proposalPrefix: "PROPOSTA",
  tableHeaders: {
    col1: "ITEM",
    col2: "DESCRIÇÃO DO DOCUMENTO",
    col3: "VALOR UNITÁRIO"
  },
  observationLabel: "Observação:",
  // Page 2 - Institutional
  whoWeAreTitle: "Quem somos?",
  whoWeAreText: "A Gama Center é uma empresa apaixonadamente comprometida com a busca de um mundo melhor e sustentável. Nascemos para alinhar as necessidades organizacionais ao contexto vital da Medicina Ocupacional e Segurança do Trabalho. Mais do que uma prestadora de serviços, aceitamos as visões dos nossos clientes como se fossem nossas, o que nos impulsiona a desenvolver ideias melhores, mais inteligentes, eficientes e inovadoras para os desafios do seu negócio.",
  ourTeamTitle: "Quem é nosso time?",
  // Team Columns
  teamCol1Title: "Segurança do trabalho",
  teamCol1Text: "• Engenheiro de Segurança do Trabalho\n• Técnica de Segurança do Trabalho",
  teamCol2Title: "Medicina Ocupacional",
  teamCol2Text: "• Médicos do Trabalho\n• Médicos examinadores\n• Analista de Saúde Ocupacional\n• Assistente de Saúde Ocupacional",
  whyChooseTitle: "Por que escolher a Gama Center?",
  whyChooseText: "Para estabelecer parcerias duradouras e alcançar resultados sem precedentes. Escolher a Gama Center significa ter soluções práticas, seguras e sustentáveis que mantêm seus colaboradores protegidos e seu negócio em total conformidade com as Normas Regulamentadoras. Projetamos ser reconhecidos como a melhor prestadora de serviços do setor porque não apenas atendemos, nós entendemos e resolvemos os seus desafios.",
  // Page 3+ - Module Intros
  introExames: `A seguir, tem-se os valores dos principais exames que podem estar atrelados a algum cargo na empresa, não implicando na necessidade de contratação de todos eles, mas somente aqueles que forem necessários de acordo com o PCMSO da empresa.

Todos os exames são realizados em nosso espaço da Clínica Gama Center, incluindo coleta de material para exames laboratoriais, exame toxicológico e outros exames complementares, com destaque ao Raio-X. Priorizamos a otimização atendimento a fim de se reduzir o tempo necessário para o trabalhador retornar à empresa.`,
  introDocumentos: '',
  introEsocial: '',
  introTreinamentos: '',
  introServicosSST: '',
  coverImage: undefined,
  backgroundImage: undefined,
  backCoverImage: undefined,
  margin: 40,
  marginTop: 40,
  marginBottom: 40,
  customModuleTitles: {},
  coverLinks: [
    { id: 'wa', x: 24.37, y: 83.61, w: 21.85, h: 2.73, url: 'https://api.whatsapp.com/send?phone=5531971920766' },
    { id: 'ig', x: 24.37, y: 87.17, w: 21.85, h: 3.09, url: 'https://www.instagram.com/gamacentersst/' }
  ],
};

// Main Content Component (Protected)
const MainApp: React.FC = () => {
  const [view, setView] = useState<ViewState>('LIST');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [proposals, setProposals] = useState<EnrichedProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<EnrichedProposal | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { signOut, user } = useAuth();

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Apply Theme Effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);


  // PDF Text Editor State (Global)
  const [isPdfEditorOpen, setIsPdfEditorOpen] = useState(false);
  const [pdfTexts, setPdfTexts] = useState(() => {
    const saved = localStorage.getItem('pdf_texts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge saved with defaults to ensure new keys exist
        return { ...DEFAULT_PDF_TEXTS, ...parsed };
      } catch (e) {
        console.error('Error parsing saved pdf texts', e);
      }
    }
    return DEFAULT_PDF_TEXTS;
  });

  const handleSavePdfTexts = (newTexts: any) => {
    setPdfTexts(newTexts);
    localStorage.setItem('pdf_texts', JSON.stringify(newTexts));
    setIsPdfEditorOpen(false);
  };

  // Initial Load
  useEffect(() => {
    refreshData();
  }, []);


  // Handle Detail View Load
  useEffect(() => {
    const fetchDetail = async () => {
      if (selectedId) {
        // We can find it in the list first for instant navigation, then re-fetch for freshness if needed
        const found = proposals.find(p => p.id === selectedId);
        if (found) setSelectedProposal(found);

        // Fetch fresh detail
        const detail = await getProposalById(selectedId);
        if (detail) setSelectedProposal(detail);
      }
    };
    fetchDetail();
  }, [selectedId]);

  const refreshData = async () => {
    setIsLoading(true);
    const data = await getProposals();
    setProposals(data);

    // Also refresh detail if we are looking at one
    if (selectedId) {
      const detail = await getProposalById(selectedId);
      if (detail) setSelectedProposal(detail);
    }
    setIsLoading(false);
  };

  const navigateToDetail = (id: number) => {
    setSelectedId(id);
    setView('DETAIL');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToList = () => {
    setView('LIST');
    setSelectedId(null);
  };

  const navigateToCreate = () => {
    setView('CREATE');
    setSelectedId(null);
  };

  const navigateToSettings = () => {
    setView('SETTINGS');
    setSelectedId(null);
  };

  const navigateToClients = () => {
    setView('CLIENTS');
    setSelectedId(null);
  };

  const handleCreateSuccess = () => {
    navigateToList();
    refreshData();
  };

  const handleQuickStatusUpdate = async (id: number, newStatus: ProposalStatus) => {
    // 1. Optimistic Update (Immediate UI feedback)
    setProposals(prev => prev.map(p =>
      p.id === id ? { ...p, status: newStatus } : p
    ));

    // 2. Persist to Backend
    await updateProposalStatus(id, newStatus);

    // 3. Optional: Refresh strictly to ensure consistency, 
    // but usually optimistic is enough for this interaction.
    // If detail is open, update it too
    if (selectedProposal && selectedProposal.id === id) {
      setSelectedProposal({ ...selectedProposal, status: newStatus });
    }
  };

  return (
    <div className="min-h-screen text-zinc-800 dark:text-zinc-100 font-sans selection:bg-blue-500/30 transition-colors duration-500">
      {/* Abstract Background Blobs */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-400/20 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-400/20 rounded-full blur-[120px] animate-pulse-slow delay-1000"></div>
        <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] bg-pink-400/20 rounded-full blur-[100px] animate-pulse-slow delay-700"></div>
      </div>

      <nav className="absolute top-4 right-16 z-50 flex items-center gap-2">
        {/* User Info */}
        {user && (
          <div className="hidden sm:flex flex-col items-end text-right mr-2">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Logado como</span>
            <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{user.email}</span>
          </div>
        )}

        <button
          onClick={navigateToClients}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-white/80 dark:hover:bg-zinc-700/80 transition-all active:scale-95"
          aria-label="Gerenciar Clientes"
        >
          <User size={18} />
        </button>

        <button
          onClick={navigateToSettings}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-white/80 dark:hover:bg-zinc-700/80 transition-all active:scale-95"
          aria-label="Editar Preços"
        >
          <SlidersHorizontal size={18} />
        </button>

        <button
          onClick={() => setIsPdfEditorOpen(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-white/80 dark:hover:bg-zinc-700/80 transition-all active:scale-95"
          aria-label="Editar Textos PDF"
        >
          <FileText size={18} />
        </button>

        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-white/80 dark:hover:bg-zinc-700/80 transition-all active:scale-95"
          aria-label="Alternar tema"
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          onClick={signOut}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/50 dark:bg-black/50 hover:bg-red-500/10 text-zinc-600 dark:text-zinc-400 hover:text-red-500 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 transition-all active:scale-95"
          aria-label="Sair"
        >
          <LogOut size={18} />
        </button>
      </nav>

      <main className={
        view === 'CREATE' || view === 'SETTINGS'
          ? 'h-screen'
          : 'px-4 sm:px-6 lg:px-8 pt-12 min-h-screen'
      }>
        {isLoading && proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
            <p className="animate-pulse">Carregando dados da nuvem...</p>
            <p className="text-xs mt-4 text-zinc-400">Isso pode levar alguns segundos.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-8 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-sm hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        ) : view === 'LIST' ? (
          <ProposalList
            proposals={proposals}
            onSelect={navigateToDetail}
            onStatusChange={handleQuickStatusUpdate}
            onCreate={navigateToCreate}
            pdfTexts={pdfTexts}
          />
        ) : view === 'CREATE' ? (
          <ProposalCreate
            onBack={navigateToList}
            onSuccess={handleCreateSuccess}
          />
        ) : view === 'SETTINGS' ? (
          <PriceEditor
            onBack={navigateToList}
          />
        ) : view === 'CLIENTS' ? (
          <ClientManagement
            onBack={navigateToList}
          />
        ) : (
          selectedProposal && (
            <ProposalDetail
              proposal={selectedProposal}
              onBack={navigateToList}
              onUpdate={refreshData}
              pdfTexts={pdfTexts}
            />
          )
        )}
      </main>

      <PdfTextEditorModal
        isOpen={isPdfEditorOpen}
        initialTexts={pdfTexts}
        onSave={handleSavePdfTexts}
        onClose={() => setIsPdfEditorOpen(false)}
        defaultTexts={DEFAULT_PDF_TEXTS}
      />
    </div>
  );
};

// Root App Component (Auth Wrapper)
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthWrapper />
    </AuthProvider>
  );
};

const AuthWrapper: React.FC = () => {
  const { session } = useAuth();

  // Check for shared proposal link
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  const sharedId = urlParams.get('id');

  if (mode === 'shared' && sharedId) {
    return <ClientProposalView proposalId={parseInt(sharedId)} />;
  }

  return session ? <MainApp /> : <LoginPage />;
};

export default App;