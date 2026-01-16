import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Type, List, Tag } from 'lucide-react';

interface PdfTexts {
    intro: string;
    footer: string;
    headerTitle: string;
    proposalPrefix: string;
    tableHeaders: {
        col1: string;
        col2: string;
        col3: string;
    };
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
}

interface PdfTextEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (texts: PdfTexts) => void;
    initialTexts: PdfTexts; // Renamed from pdfTexts to avoid confusion
    defaultTexts?: PdfTexts; // Added defaultTexts prop
}

export const PdfTextEditorModal: React.FC<PdfTextEditorModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialTexts,
    defaultTexts
}) => {
    const [localTexts, setLocalTexts] = useState<PdfTexts>(initialTexts);
    const [activeTab, setActiveTab] = useState<'institutional' | 'modules'>('institutional');
    const [activeModule, setActiveModule] = useState<'Exames' | 'Documentos' | 'eSocial' | 'Treinamentos' | 'Serviços SST'>('Exames');

    // Reset state when modal opens or initialTexts changes
    useEffect(() => {
        if (isOpen) {
            setLocalTexts(initialTexts);
        }
    }, [isOpen, initialTexts]);

    const handleRestoreDefaults = () => {
        if (defaultTexts && confirm('Tem certeza que deseja restaurar os textos padrão do PDF modelo? Isso substituirá suas alterações atuais.')) {
            setLocalTexts(defaultTexts);
        }
    };

    const handleChange = (field: keyof PdfTexts, value: string) => {
        setLocalTexts(prev => ({ ...prev, [field]: value }));
    };

    const handleTableHeaderChange = (col: 'col1' | 'col2' | 'col3', value: string) => {
        setLocalTexts(prev => ({
            ...prev,
            tableHeaders: { ...prev.tableHeaders, [col]: value }
        }));
    };

    if (!isOpen) return null;

    // Helper to map activeModule to the correct text field key
    const getModuleKey = (mod: typeof activeModule): keyof PdfTexts => {
        switch (mod) {
            case 'Exames': return 'introExames';
            case 'Documentos': return 'introDocumentos';
            case 'eSocial': return 'introEsocial';
            case 'Treinamentos': return 'introTreinamentos';
            case 'Serviços SST': return 'introServicosSST';
        }
    };

    const currentModuleIntroKey = getModuleKey(activeModule);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-stone-100 dark:bg-zinc-900 w-full max-w-5xl h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in border border-white/20">

                {/* Header */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Editor de Texto do PDF</h3>
                            <p className="text-xs text-zinc-500">Personalize os textos institucionais e de cada módulo</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-zinc-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('institutional')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'institutional' ? 'bg-white shadow text-blue-600' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            Institucional (Pág 2)
                        </button>
                        <button
                            onClick={() => setActiveTab('modules')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'modules' ? 'bg-white shadow text-blue-600' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            Módulos (Págs 3+)
                        </button>
                    </div>

                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content - Visual Preview like */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-zinc-200/50 dark:bg-black/50 flex justify-center">

                    {/* A4 Page Container */}
                    <div className="w-full max-w-[21cm] min-h-[29.7cm] bg-white text-black shadow-2xl p-[2cm] flex flex-col mb-8 relative transition-all duration-300">

                        {activeTab === 'institutional' ? (
                            <>
                                <h2 className="text-zinc-300 font-bold text-center mb-12 uppercase tracking-widest text-[10px] top-4 absolute w-full left-0">--- PÁGINA 2: INSTITUCIONAL ---</h2>

                                {/* WHO WE ARE */}
                                <div className="mb-8 group relative border border-transparent hover:border-blue-200 rounded p-1 transition-all">
                                    <input
                                        value={localTexts.whoWeAreTitle || 'Quem somos?'}
                                        onChange={(e) => handleChange('whoWeAreTitle', e.target.value)}
                                        className="w-full font-bold text-[#07889B] text-xl mb-4 bg-transparent outline-none"
                                    />
                                    <textarea
                                        value={localTexts.whoWeAreText || ''}
                                        onChange={(e) => handleChange('whoWeAreText', e.target.value)}
                                        className="w-full text-[10px] leading-relaxed text-justify h-24 bg-transparent resize-none outline-none text-zinc-700 font-sans"
                                    />
                                </div>

                                {/* OUR TEAM */}
                                <div className="mb-8">
                                    <div className="group relative border border-transparent hover:border-blue-200 rounded p-1 transition-all mb-2">
                                        <input
                                            value={localTexts.ourTeamTitle || 'Quem é nosso time?'}
                                            onChange={(e) => handleChange('ourTeamTitle', e.target.value)}
                                            className="w-full font-bold text-[#07889B] text-xl mb-4 bg-transparent outline-none"
                                        />
                                    </div>

                                    {/* Team Columns Layout */}
                                    <div className="grid grid-cols-2 gap-0">
                                        {/* Col 1 */}
                                        <div>
                                            {/* Gray Header */}
                                            <div className="bg-[#EAEAEA] py-1 px-2 mb-2 group relative hover:ring-1 hover:ring-blue-300">
                                                <input
                                                    value={localTexts.teamCol1Title || 'Segurança do trabalho'}
                                                    onChange={(e) => handleChange('teamCol1Title', e.target.value)}
                                                    className="w-full font-bold text-black text-[10px] bg-transparent outline-none"
                                                />
                                            </div>
                                            {/* Content */}
                                            <div className="px-2 group relative hover:ring-1 hover:ring-blue-300 rounded">
                                                <textarea
                                                    value={localTexts.teamCol1Text || ''}
                                                    onChange={(e) => handleChange('teamCol1Text', e.target.value)}
                                                    className="w-full text-[10px] h-20 bg-transparent resize-none outline-none text-zinc-700 font-sans leading-relaxed"
                                                />
                                            </div>
                                        </div>

                                        {/* Col 2 */}
                                        <div>
                                            {/* Gray Header */}
                                            <div className="bg-[#EAEAEA] py-1 px-2 mb-2 group relative hover:ring-1 hover:ring-blue-300">
                                                <input
                                                    value={localTexts.teamCol2Title || 'Medicina Ocupacional'}
                                                    onChange={(e) => handleChange('teamCol2Title', e.target.value)}
                                                    className="w-full font-bold text-black text-[10px] bg-transparent outline-none"
                                                />
                                            </div>
                                            {/* Content */}
                                            <div className="px-2 group relative hover:ring-1 hover:ring-blue-300 rounded">
                                                <textarea
                                                    value={localTexts.teamCol2Text || ''}
                                                    onChange={(e) => handleChange('teamCol2Text', e.target.value)}
                                                    className="w-full text-[10px] h-20 bg-transparent resize-none outline-none text-zinc-700 font-sans leading-relaxed"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* WHY CHOOSE */}
                                <div className="mb-0 group relative border border-transparent hover:border-blue-200 rounded p-1 transition-all">
                                    <input
                                        value={localTexts.whyChooseTitle || 'Por que escolher a Gama Center?'}
                                        onChange={(e) => handleChange('whyChooseTitle', e.target.value)}
                                        className="w-full font-bold text-[#07889B] text-xl mb-4 bg-transparent outline-none"
                                    />
                                    <textarea
                                        value={localTexts.whyChooseText || ''}
                                        onChange={(e) => handleChange('whyChooseText', e.target.value)}
                                        className="w-full text-[10px] leading-relaxed text-justify h-32 bg-transparent resize-none outline-none text-zinc-700 font-sans"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 className="text-zinc-300 font-bold text-center mb-8 uppercase tracking-widest text-[10px] top-4 absolute w-full left-0">--- MÓDULO: {activeModule.toUpperCase()} ---</h2>

                                {/* Module Switcher */}
                                <div className="flex flex-wrap gap-2 mb-8 justify-center px-4">
                                    {(['Exames', 'Documentos', 'eSocial', 'Treinamentos', 'Serviços SST'] as const).map(mod => (
                                        <button
                                            key={mod}
                                            onClick={() => setActiveModule(mod)}
                                            className={`px-3 py-1 text-[10px] font-bold rounded border ${activeModule === mod ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-500 border-zinc-200 hover:border-blue-300'}`}
                                        >
                                            {mod}
                                        </button>
                                    ))}
                                </div>

                                {/* Module Intro Layout - Per Image */}

                                {/* 1. Header Title */}
                                <div className="group relative mb-8">
                                    <label className="absolute -top-3 left-0 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                        <Type size={9} /> Título Principal (Todas as pgs)
                                    </label>
                                    <input
                                        type="text"
                                        value={localTexts.headerTitle}
                                        onChange={(e) => handleChange('headerTitle', e.target.value)}
                                        className="w-full text-black font-bold text-lg bg-transparent hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded px-1 transition-colors"
                                    />
                                </div>

                                {/* 2. Module Title + Client */}
                                <div className="text-center space-y-2 mb-8">
                                    <div className="group relative inline-block">
                                        <div className="flex items-center justify-center gap-1 text-black font-bold text-lg uppercase outline-none">
                                            <span>
                                                {localTexts.proposalPrefix || 'PROPOSTA'} {activeModule.toUpperCase()}
                                            </span>
                                        </div>
                                        <label className="absolute -top-5 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                            Edite o prefixo "PROPOSTA" na aba Institucional se desejar
                                        </label>
                                    </div>
                                    <h3 className="text-black text-base uppercase">[NOME DO CLIENTE]</h3>
                                </div>

                                {/* 3. Intro Text for this Module */}
                                <div className="mb-8 group relative rounded-lg border-2 border-transparent hover:border-blue-300 p-2 transition-all">
                                    <label className="absolute -top-3 left-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                        <Type size={10} /> Intro: {activeModule}
                                    </label>
                                    <textarea
                                        value={localTexts[currentModuleIntroKey] || ''}
                                        onChange={(e) => handleChange(currentModuleIntroKey, e.target.value)}
                                        className="w-full h-80 p-2 text-justify text-[10px] leading-relaxed font-sans text-zinc-800 outline-none resize-none bg-transparent placeholder-zinc-300 focus:bg-blue-50/20"
                                        placeholder={`Digite o texto introdutório para o módulo de ${activeModule}...`}
                                    />
                                </div>

                                {/* Table Placeholder */}
                                <div className="text-center mt-auto mb-8 opacity-30 pb-16">
                                    <div className="border border-dashed border-black p-4">
                                        <p className="font-bold">TABELA DE {activeModule.toUpperCase()}</p>
                                        <p className="text-[10px]">(Gerada automaticamente com os itens)</p>
                                    </div>
                                </div>

                            </>
                        )}

                        {/* Footer Input - Inside A4 Layout */}
                        <div className="mt-auto pt-8 border-t border-transparent group relative hover:border-zinc-200 transition-all">
                            <label className="absolute -top-3 left-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                <Type size={10} /> Rodapé
                            </label>
                            <input
                                type="text"
                                value={localTexts.footer}
                                onChange={(e) => handleChange('footer', e.target.value)}
                                className="w-full text-center text-[10px] text-zinc-500 outline-none bg-transparent font-sans border-b border-transparent focus:border-blue-300 focus:bg-blue-50/50 p-1 transition-all"
                                placeholder="Gama Center SST - 2025 - Página X"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900">
                    {defaultTexts && (
                        <button
                            onClick={handleRestoreDefaults}
                            className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-sm"
                            title="Restaurar textos originais do PDF"
                        >
                            <FileText className="w-4 h-4" />
                            Restaurar Padrão
                        </button>
                    )}
                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={onClose}
                            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4" />
                            Cancelar
                        </button>
                        <button
                            onClick={() => onSave(localTexts)}
                            className="flex items-center gap-2 px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                        >
                            <Save className="w-4 h-4" />
                            Salvar Alterações
                        </button>
                    </div>
                </div>

            </div>
        </div >
    );
};
