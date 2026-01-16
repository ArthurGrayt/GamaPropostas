import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Check, AlertCircle, Plus, Minus, ArrowRight, FileText, ListChecks, Square, CheckSquare } from 'lucide-react';
import { CatalogContext } from '../services/mockData';
import { Procedimento } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (items: { procedureId: number; quantity: number }[]) => void;
    catalog: CatalogContext;
}

interface DetectedItem {
    procedure: Procedimento;
    quantity: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    matchReason: string;
    score: number;
    selected: boolean; // NEW: Track selection state
}

export const TextImportModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, catalog }) => {
    const [inputText, setInputText] = useState('');
    const [step, setStep] = useState<'INPUT' | 'REVIEW'>('INPUT');
    const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    if (!isOpen) return null;

    const analyzeText = () => {
        if (!inputText.trim()) return;
        setIsAnalyzing(true);
        console.log("=== INICIANDO ANÁLISE DE TEXTO (v7 - Selection UI) ===");

        setTimeout(() => {
            const items: DetectedItem[] = [];
            const usedProcedureIds = new Set<number>();
            const usedNames = new Set<string>();

            // 1. Advanced Normalization
            const normalize = (str: string) => str.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9\s]/gi, ' ');

            const levenshtein = (a: string, b: string): number => {
                const matrix = [];
                for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
                for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
                for (let i = 1; i <= b.length; i++) {
                    for (let j = 1; j <= a.length; j++) {
                        if (b.charAt(i - 1) == a.charAt(j - 1)) {
                            matrix[i][j] = matrix[i - 1][j - 1];
                        } else {
                            matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
                        }
                    }
                }
                return matrix[b.length][a.length];
            };

            const isSubsequence = (needle: string, haystack: string): boolean => {
                let i = 0, j = 0;
                while (i < needle.length && j < haystack.length) {
                    if (needle[i] === haystack[j]) i++;
                    j++;
                }
                return i === needle.length;
            };

            const acronymMap: Record<string, string[]> = {
                'pgr': ['programa de gerenciamento de riscos'],
                'pcmso': ['programa de controle medico de saude ocupacional'],
                'ltcat': ['laudo tecnico das condicoes ambientais do trabalho'],
                'ppp': ['perfil profissiografico previdenciario'],
                'aso': ['atestado de saude ocupacional'],
                'audiometria': ['audiometria'],
                'hemograma': ['hemograma', 'exame de sangue'],
            };

            const cleanText = normalize(inputText);
            const rawTokens = cleanText.split(/\s+/).filter(t => t.length > 0);
            const searchTokens = [...rawTokens];
            for (let i = 0; i < rawTokens.length - 1; i++) {
                const bigram = rawTokens[i] + rawTokens[i + 1];
                if (bigram.length > 3) searchTokens.push(bigram);
            }

            const finalSearchTokens = [...searchTokens];
            Object.keys(acronymMap).forEach(acronym => {
                const found = searchTokens.some(t => levenshtein(t, acronym) <= 1 || (t.length < acronym.length * 3 && isSubsequence(acronym, t)));
                if (found) {
                    acronymMap[acronym].forEach(exp => finalSearchTokens.push(...normalize(exp).split(/\s+/)));
                    finalSearchTokens.push(acronym);
                }
            });

            const checkMatch = (proc: Procedimento): { matched: boolean; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; reason: string; score: number } => {
                if (!proc.nome || !proc.nome.trim()) return { matched: false, confidence: 'LOW', reason: 'Nome inválido', score: 0 };

                const normProcName = normalize(proc.nome);
                const ignoredWords = ['de', 'da', 'do', 'dos', 'das', 'para', 'com', 'em', 'um', 'uma', 'o', 'a', 'e', 'ou', 'que', 'se', 'na', 'no'];
                const procKeywords = normProcName.split(/\s+/).filter(w => w.length > 2 && isNaN(Number(w)) && !ignoredWords.includes(w));

                if (procKeywords.length === 0) return { matched: false, confidence: 'LOW', reason: '', score: 0 };

                let matchedKeywords = 0;
                let maxKeywordLength = 0;

                procKeywords.forEach(keyword => {
                    let found = false;
                    for (const token of finalSearchTokens) {
                        let threshold = keyword.length < 5 ? 1 : Math.floor(keyword.length * 0.4);
                        threshold = Math.min(threshold, 5);
                        if (levenshtein(token, keyword) <= threshold || (keyword.length > 4 && token.length > keyword.length && isSubsequence(keyword, token))) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        matchedKeywords++;
                        maxKeywordLength = Math.max(maxKeywordLength, keyword.length);
                    }
                });

                const matchRatio = matchedKeywords / procKeywords.length;
                if (matchRatio >= 0.8) return { matched: true, confidence: matchRatio === 1 ? 'HIGH' : 'MEDIUM', reason: 'Proximidade semântica detectada', score: matchRatio };
                if (matchedKeywords > 0 && maxKeywordLength > 6) return { matched: true, confidence: 'MEDIUM', reason: 'Palavra-chave específica identificada', score: procKeywords.length > 1 ? 0.6 : matchRatio };
                if (matchRatio >= 0.5) return { matched: true, confidence: 'LOW', reason: 'Correspondência parcial', score: matchRatio };

                const isAcronymLike = normProcName.length < 8 && !normProcName.includes(' ');
                if (isAcronymLike) {
                    if (finalSearchTokens.some(t => isSubsequence(normProcName, t) && t.length < normProcName.length * 4)) {
                        return { matched: true, confidence: 'HIGH', reason: 'Sigla detectada', score: 1.0 };
                    }
                }
                return { matched: false, confidence: 'LOW', reason: '', score: 0 };
            };

            catalog.procedimentos.forEach(proc => {
                const procNormName = normalize(proc.nome || '');
                if (usedProcedureIds.has(proc.id) || usedNames.has(procNormName)) return;

                const match = checkMatch(proc);
                if (match.matched && match.score >= 0.5) {
                    items.push({
                        procedure: proc,
                        quantity: 1,
                        confidence: match.confidence,
                        matchReason: match.reason,
                        score: match.score,
                        selected: true // Default to selected
                    });
                    usedProcedureIds.add(proc.id);
                    usedNames.add(procNormName);
                }
            });

            items.sort((a, b) => (b.score - a.score) || a.procedure.nome.localeCompare(b.procedure.nome));

            setDetectedItems(items);
            setStep('REVIEW');
            setIsAnalyzing(false);
        }, 800);
    };

    const handleConfirm = () => {
        // Filter only selected items
        const selectedOnly = detectedItems.filter(i => i.selected);
        onConfirm(selectedOnly.map(i => ({ procedureId: i.procedure.id, quantity: i.quantity })));
        handleClose();
    };

    const handleClose = () => {
        setDetectedItems([]);
        setInputText('');
        setStep('INPUT');
        onClose();
    };

    const toggleItemSelection = (index: number) => {
        const newItems = [...detectedItems];
        newItems[index] = { ...newItems[index], selected: !newItems[index].selected };
        setDetectedItems(newItems);
    };

    const updateQuantity = (index: number, delta: number) => {
        const newItems = [...detectedItems];
        const current = newItems[index];
        const newQty = Math.max(1, current.quantity + delta);
        newItems[index] = { ...current, quantity: newQty };
        setDetectedItems(newItems);
    };

    const selectedCount = detectedItems.filter(i => i.selected).length;

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={handleClose}></div>

            <div className={`
                bg-white dark:bg-zinc-900 w-full 
                ${step === 'INPUT' ? 'max-w-2xl' : 'max-w-6xl'} 
                rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-10 flex flex-col max-h-[90vh] 
                transition-all duration-500 ease-in-out relative overflow-hidden
            `}>

                {/* Header */}
                <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-black/20">
                    <div>
                        <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                            {step === 'INPUT' ? <Search className="w-5 h-5 text-blue-500" /> : <ListChecks className="w-5 h-5 text-green-500" />}
                            {step === 'INPUT' ? 'Adicionar Itens por Texto' : 'Confirmar Itens Detectados'}
                        </h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            {step === 'INPUT'
                                ? 'Cole o texto da solicitação para detecção automática.'
                                : `Selecione os procedimentos que deseja adicionar (${selectedCount} selecionados).`}
                        </p>
                    </div>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                        <X size={20} className="text-zinc-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {step === 'INPUT' ? (
                        <div className="p-6 h-full flex flex-col">
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Cole aqui o texto do email, whatsapp ou documento..."
                                className="flex-1 w-full min-h-[200px] p-4 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none resize-none font-sans text-base leading-relaxed text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
                                autoFocus
                            />
                        </div>
                    ) : (
                        <div className="flex h-full min-h-0 divide-x divide-zinc-100 dark:divide-zinc-800">
                            {/* Left Column: Original Text */}
                            <div className="w-[35%] flex flex-col bg-zinc-50/30 dark:bg-black/10 min-h-0">
                                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center gap-2">
                                    <FileText size={16} className="text-zinc-500" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Texto Original</span>
                                </div>
                                <div className="flex-1 p-6 overflow-y-auto">
                                    <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap shadow-sm">
                                        {inputText}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Detected Items */}
                            <div className="w-[65%] flex flex-col min-h-0">
                                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Check size={16} className="text-green-500" />
                                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Itens Encontrados ({detectedItems.length})</span>
                                    </div>
                                    <button
                                        onClick={() => setDetectedItems(detectedItems.map(i => ({ ...i, selected: !detectedItems.every(x => x.selected) })))}
                                        className="text-[10px] font-bold text-blue-600 hover:text-blue-500 uppercase tracking-tight"
                                    >
                                        {detectedItems.every(i => i.selected) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                    </button>
                                </div>

                                <div className="flex-1 p-6 overflow-y-auto scrollbar-thin">
                                    {detectedItems.length === 0 ? (
                                        <div className="text-center py-12 text-zinc-400">
                                            <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
                                            <p className="text-lg font-medium">Nenhum procedimento identificado.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {detectedItems.map((item, idx) => (
                                                <div
                                                    key={item.procedure.id}
                                                    onClick={() => toggleItemSelection(idx)}
                                                    className={`
                                                        flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer group relative
                                                        ${item.selected
                                                            ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                                                            : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 opacity-60 grayscale-[0.5]'}
                                                    `}
                                                >
                                                    {/* Custom Checkbox */}
                                                    <div className={`mt-0.5 transition-colors ${item.selected ? 'text-blue-600' : 'text-zinc-300 dark:text-zinc-600'}`}>
                                                        {item.selected ? <CheckSquare size={20} /> : <Square size={20} />}
                                                    </div>

                                                    {/* Details */}
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className={`text-sm font-semibold leading-snug break-words ${item.selected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`}>
                                                            {item.procedure.nome}
                                                        </h4>
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                                            <span className="bg-zinc-100 dark:bg-zinc-700/50 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                                                                {(item.procedure.preco_avulso ?? item.procedure.preco ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </span>
                                                            <span className={`text-[10px] font-medium ${item.selected ? 'text-blue-500' : 'text-zinc-400'}`}>
                                                                {Math.round(item.score * 100)}% - {item.matchReason}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Quantity Controls (Only if selected) */}
                                                    {item.selected && (
                                                        <div className="flex items-center gap-2 self-center bg-white dark:bg-zinc-900 rounded-lg p-0.5 shadow-sm border border-zinc-100 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
                                                            <button onClick={() => updateQuantity(idx, -1)} className="p-1 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded transition-all text-zinc-500"><Minus size={12} /></button>
                                                            <span className="w-6 text-center text-xs font-bold font-mono text-zinc-800 dark:text-zinc-200">{item.quantity}</span>
                                                            <button onClick={() => updateQuantity(idx, 1)} className="p-1 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded transition-all text-zinc-500"><Plus size={12} /></button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-black/20 flex gap-3 justify-end items-center backdrop-blur-sm">
                    {step === 'INPUT' ? (
                        <button
                            onClick={analyzeText}
                            disabled={!inputText.trim() || isAnalyzing}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                        >
                            {isAnalyzing ? 'Analisando...' : 'Analisar Texto'} {isAnalyzing ? <span className="animate-spin inline-block ml-1">⏳</span> : <Search size={18} />}
                        </button>
                    ) : (
                        <>
                            <button onClick={() => setStep('INPUT')} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 px-4 py-2 font-medium transition-colors">
                                Voltar e Editar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={selectedCount === 0}
                                className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-green-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                            >
                                Adicionar {selectedCount} {selectedCount === 1 ? 'Item' : 'Itens'} <ArrowRight size={18} />
                            </button>
                        </>
                    )}
                </div>

            </div>
        </div>,
        document.body
    );
};
