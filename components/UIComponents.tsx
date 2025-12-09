import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CheckCircle, XCircle, Clock, Search, X, Archive } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Glass Card ---
// Uses backdrop-blur and semi-transparent backgrounds to simulate frosted glass
export const GlassCard: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({
  children, className, onClick
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white/60 dark:bg-black/40 backdrop-blur-2xl border border-neutral-200/60 dark:border-white/10 shadow-xl",
        "rounded-[32px] p-6 transition-all duration-300 ease-spring",
        onClick && "cursor-pointer active:scale-[0.98] hover:bg-white/80 dark:hover:bg-black/50 hover:shadow-2xl",
        className
      )}
    >
      {children}
    </div>
  );
};

// --- Search Bar ---
export const SearchBar: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder = "Buscar...", className }) => {
  return (
    <div className={cn("relative group", className)}>
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-blue-500 transition-colors">
        <Search size={20} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 pl-11 pr-10 rounded-2xl bg-white/80 dark:bg-zinc-800/50 backdrop-blur-md border border-neutral-200/50 dark:border-white/5 focus:ring-2 focus:ring-blue-500/50 focus:outline-none text-zinc-800 dark:text-white placeholder-zinc-400 shadow-sm transition-all"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          <X size={16} className="bg-zinc-200 dark:bg-zinc-700 rounded-full p-0.5 w-5 h-5" />
        </button>
      )}
    </div>
  );
};

// --- Filter Pill ---
export const FilterPill: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
  count?: number;
}> = ({ label, isActive, onClick, count }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 border whitespace-nowrap",
        isActive
          ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/25"
          : "bg-white/80 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-300 border-neutral-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-zinc-700/80"
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn(
          "ml-2 text-xs py-0.5 px-1.5 rounded-full",
          isActive ? "bg-white/20 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
        )}>
          {count}
        </span>
      )}
    </button>
  );
};

// --- Status Badge ---
// Dynamic colors based on proposal status
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles = {
    PENDING: "bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-400/30",
    APPROVED: "bg-emerald-400/20 text-emerald-700 dark:text-emerald-300 border-emerald-400/30",
    REJECTED: "bg-rose-400/20 text-rose-700 dark:text-rose-300 border-rose-400/30",
    ARCHIVED: "bg-zinc-400/20 text-zinc-600 dark:text-zinc-400 border-zinc-400/30",
  };

  const labels = {
    PENDING: "Pendente",
    APPROVED: "Aprovada",
    REJECTED: "Reprovada",
    ARCHIVED: "Arquivada",
  };

  const icons = {
    PENDING: <Clock size={14} className="mr-1.5" />,
    APPROVED: <CheckCircle size={14} className="mr-1.5" />,
    REJECTED: <XCircle size={14} className="mr-1.5" />,
    ARCHIVED: <Archive size={14} className="mr-1.5" />
  };

  const style = styles[status as keyof typeof styles] || styles.PENDING;
  const label = labels[status as keyof typeof labels] || status;
  const icon = icons[status as keyof typeof icons];

  return (
    <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border backdrop-blur-sm", style)}>
      {icon}
      {label}
    </span>
  );
};

// --- iOS Style Switch ---
export const IOSSwitch: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={cn(
        "w-12 h-7 rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out relative",
        checked ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600"
      )}
    >
      <div
        className={cn(
          "bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ease-spring-bouncy",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </div>
  );
};

// --- Action Button ---
export const ActionButton: React.FC<{
  label: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'danger' | 'neutral';
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}> = ({ label, icon, variant = 'primary', onClick, className, disabled }) => {
  const baseStyles = "flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-semibold transition-all duration-200 active:scale-95 shadow-lg backdrop-blur-md";
  const variants = {
    primary: "bg-blue-600/90 hover:bg-blue-500 text-white shadow-blue-500/30",
    danger: "bg-red-500/90 hover:bg-red-400 text-white shadow-red-500/30",
    neutral: "bg-white/50 hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/20 text-zinc-800 dark:text-white border border-white/20",
  };
  const disabledStyles = "disabled:bg-zinc-400/50 dark:disabled:bg-zinc-800/50 disabled:text-zinc-500 dark:disabled:text-zinc-600 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100";


  return (
    <button onClick={onClick} disabled={disabled} className={cn(baseStyles, variants[variant], disabledStyles, className)}>
      {icon}
      <span>{label}</span>
    </button>
  );
};

// --- Avatar ---
export const Avatar: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/50 shadow-sm shrink-0">
    <img src={src} alt={alt} className="w-full h-full object-cover" />
  </div>
);
import { Client } from '../types';
import { Plus, Check, ChevronDown, User } from 'lucide-react';

export const ClientSelector: React.FC<{
  clients: Client[];
  selectedClientId: string;
  onSelect: (clientId: string) => void;
  onCreateNew: () => void;
  className?: string;
}> = ({ clients, selectedClientId, onSelect, onCreateNew, className }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const filteredClients = React.useMemo(() => {
    return clients.filter(c =>
      (c.nome || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.nome_fantasia || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.razao_social || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [clients, search]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 rounded-2xl bg-white/80 dark:bg-zinc-800/50 backdrop-blur-md border border-neutral-200/50 dark:border-white/5 flex items-center justify-between px-4 cursor-pointer hover:bg-white dark:hover:bg-zinc-800 transition-colors shadow-sm"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            {selectedClient?.avatar ? (
              <img src={selectedClient.avatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User size={16} />
            )}
          </div>
          <span className={cn("truncate font-medium", !selectedClient && "text-zinc-400")}>
            {selectedClient ? (selectedClient.nome_fantasia || selectedClient.nome) : "Selecione um cliente..."}
          </span>
        </div>
        <ChevronDown size={16} className={cn("text-zinc-400 transition-transform duration-300", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-zinc-800 overflow-hidden z-50 animate-fade-in origin-top">
          <div className="p-2 border-b border-neutral-100 dark:border-zinc-800">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1">
            {filteredClients.length === 0 && (
              <div className="py-4 text-center text-zinc-400 text-sm">Nenhum cliente encontrado.</div>
            )}
            {filteredClients.map(client => (
              <button
                key={client.id}
                onClick={() => {
                  onSelect(client.id);
                  setIsOpen(false);
                  setSearch('');
                }}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between group transition-colors",
                  selectedClientId === client.id
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                )}
              >
                <span className="font-medium truncate">{client.nome_fantasia || client.nome}</span>
                {selectedClientId === client.id && <Check size={16} />}
              </button>
            ))}
          </div>

          <div className="p-2 border-t border-neutral-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <button
              onClick={() => {
                onCreateNew();
                setIsOpen(false);
              }}
              className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/20"
            >
              <Plus size={16} />
              Novo Cliente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};