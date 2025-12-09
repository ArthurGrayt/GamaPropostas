import React, { useState, useEffect } from 'react';
import { ProposalList } from './components/ProposalList';
import { ProposalDetail } from './components/ProposalDetail';
import { ProposalCreate } from './components/ProposalCreate';
import { PriceEditor } from './components/PriceEditor';
import { getProposals, getProposalById, updateProposalStatus } from './services/mockData';
import { EnrichedProposal, ProposalStatus } from './types';
import { Loader2 } from 'lucide-react';

type ViewState = 'LIST' | 'DETAIL' | 'CREATE' | 'SETTINGS';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('LIST');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [proposals, setProposals] = useState<EnrichedProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<EnrichedProposal | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

      <main className={
        view === 'CREATE' || view === 'SETTINGS'
          ? 'h-screen'
          : 'px-4 sm:px-6 lg:px-8 pt-12 min-h-screen'
      }>
        {isLoading && proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
            <p className="animate-pulse">Carregando dados da nuvem...</p>
          </div>
        ) : view === 'LIST' ? (
          <ProposalList
            proposals={proposals}
            onSelect={navigateToDetail}
            onStatusChange={handleQuickStatusUpdate}
            isDarkMode={isDarkMode}
            onToggleTheme={toggleTheme}
            onCreate={navigateToCreate}
            onNavigateToSettings={navigateToSettings}
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

export default App;