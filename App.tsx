import React, { useState, useEffect } from 'react';
import { ProposalList } from './components/ProposalList';
import { ProposalDetail } from './components/ProposalDetail';
import { ProposalCreate } from './components/ProposalCreate';
import { ClientManagement } from './components/ClientManagement';
import { PriceEditor } from './components/PriceEditor';
import { getProposals, getProposalById, updateProposalStatus } from './services/mockData';
import { EnrichedProposal, ProposalStatus } from './types';
import { Loader2, LogOut, User, SlidersHorizontal, Sun, Moon } from 'lucide-react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { LoginPage } from './components/LoginPage';
import { ClientProposalView } from './components/ClientProposalView';

type ViewState = 'LIST' | 'DETAIL' | 'CREATE' | 'SETTINGS' | 'CLIENTS';

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

      {view === 'LIST' && (
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
      )}

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
            />
          )
        )}
      </main>
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