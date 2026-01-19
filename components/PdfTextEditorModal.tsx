import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Type, List, Tag, Image, Upload, Trash2, Loader2, Check, SlidersHorizontal } from 'lucide-react';
import { uploadPdfAsset } from '../services/mockData';

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
    coverImage?: string;
    backgroundImage?: string;
    backCoverImage?: string;
    margin?: number;
    marginTop?: number;
    marginBottom?: number;
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
    const [activeTab, setActiveTab] = useState<'institutional' | 'modules' | 'images'>('institutional');
    const [activeImageSection, setActiveImageSection] = useState<'cover' | 'backCover' | 'background'>('cover');
    const [activeModule, setActiveModule] = useState<'Exames' | 'Documentos' | 'eSocial' | 'Treinamentos' | 'Serviços SST'>('Exames');
    const [isUploading, setIsUploading] = useState<string | null>(null);

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

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: 'coverImage' | 'backgroundImage' | 'backCoverImage') => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(field);
        try {
            const { publicUrl, error } = await uploadPdfAsset(file);
            if (publicUrl) {
                setLocalTexts(prev => ({
                    ...prev,
                    [field]: publicUrl
                }));
            } else {
                alert(`Erro ao fazer upload da imagem: ${error || 'Erro desconhecido'}`);
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Erro ao fazer upload da imagem.');
        } finally {
            setIsUploading(null);
        }
    };

    const handleRemoveImage = (field: 'coverImage' | 'backgroundImage' | 'backCoverImage') => {
        setLocalTexts(prev => ({
            ...prev,
            [field]: undefined
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
                        <button
                            onClick={() => setActiveTab('images')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'images' ? 'bg-white shadow text-blue-600' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            Imagens
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

                        {activeTab === 'images' ? (
                            <>
                                <h2 className="text-zinc-300 font-bold text-center mb-8 uppercase tracking-widest text-[10px] top-4 absolute w-full left-0">--- IMAGENS E FUNDOS ---</h2>

                                {/* Image Section Switcher */}
                                <div className="flex flex-wrap gap-2 mb-8 justify-center px-4 relative z-10">
                                    <button
                                        onClick={() => setActiveImageSection('cover')}
                                        className={`px-3 py-1 text-[10px] font-bold rounded border ${activeImageSection === 'cover' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-500 border-zinc-200 hover:border-blue-300'}`}
                                    >
                                        Capa
                                    </button>
                                    <button
                                        onClick={() => setActiveImageSection('backCover')}
                                        className={`px-3 py-1 text-[10px] font-bold rounded border ${activeImageSection === 'backCover' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-500 border-zinc-200 hover:border-blue-300'}`}
                                    >
                                        Contracapa
                                    </button>
                                    <button
                                        onClick={() => setActiveImageSection('background')}
                                        className={`px-3 py-1 text-[10px] font-bold rounded border ${activeImageSection === 'background' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-500 border-zinc-200 hover:border-blue-300'}`}
                                    >
                                        Fundo (Páginas)
                                    </button>
                                </div>

                                <div className="flex flex-col gap-8 h-full">

                                    {/* Cover Image Upload */}
                                    {activeImageSection === 'cover' && (
                                        <div className="mt-4 space-y-4 animate-fade-in">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-bold text-zinc-800 flex items-center gap-2">
                                                    <Image size={18} className="text-blue-500" />
                                                    Capa Personalizada
                                                </h3>
                                                {localTexts.coverImage && (
                                                    <button
                                                        onClick={() => handleRemoveImage('coverImage')}
                                                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                                                    >
                                                        <Trash2 size={12} /> Remover
                                                    </button>
                                                )}
                                            </div>

                                            <div className={`relative w-full aspect-[21/29.7] rounded-lg border-2 border-dashed ${localTexts.coverImage ? 'border-transparent' : 'border-zinc-300 hover:border-blue-400'} flex flex-col items-center justify-center transition-all bg-zinc-50 overflow-hidden group`}>
                                                {localTexts.coverImage ? (
                                                    <>
                                                        <img src={localTexts.coverImage} alt="Capa" className="absolute inset-0 w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <label className="cursor-pointer bg-white text-zinc-800 px-4 py-2 rounded-full font-bold text-sm shadow-lg hover:scale-105 transition-transform">
                                                                Trocar Imagem
                                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'coverImage')} />
                                                            </label>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <label className="cursor-pointer flex flex-col items-center gap-2 p-8 text-zinc-400 hover:text-blue-500 w-full h-full justify-center">
                                                        {isUploading === 'coverImage' ? (
                                                            <Loader2 className="animate-spin" size={32} />
                                                        ) : (
                                                            <>
                                                                <Upload size={32} />
                                                                <span className="text-sm font-medium">Clique para enviar imagem (A4 Vertical)</span>
                                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'coverImage')} />
                                                            </>
                                                        )}
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Back Cover Image Upload */}
                                    {activeImageSection === 'backCover' && (
                                        <div className="space-y-4 mt-4 animate-fade-in">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-bold text-zinc-800 flex items-center gap-2">
                                                    <Image size={18} className="text-blue-500" />
                                                    Contracapa Personalizada (Última Página)
                                                </h3>
                                                {localTexts.backCoverImage && (
                                                    <button
                                                        onClick={() => handleRemoveImage('backCoverImage')}
                                                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                                                    >
                                                        <Trash2 size={12} /> Remover
                                                    </button>
                                                )}
                                            </div>

                                            <div className={`relative w-full aspect-[21/29.7] rounded-lg border-2 border-dashed ${localTexts.backCoverImage ? 'border-transparent' : 'border-zinc-300 hover:border-blue-400'} flex flex-col items-center justify-center transition-all bg-zinc-50 overflow-hidden group`}>
                                                {localTexts.backCoverImage ? (
                                                    <>
                                                        <img src={localTexts.backCoverImage} alt="Contracapa" className="absolute inset-0 w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <label className="cursor-pointer bg-white text-zinc-800 px-4 py-2 rounded-full font-bold text-sm shadow-lg hover:scale-105 transition-transform">
                                                                Trocar Imagem
                                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'backCoverImage')} />
                                                            </label>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <label className="cursor-pointer flex flex-col items-center gap-2 p-8 text-zinc-400 hover:text-blue-500 w-full h-full justify-center">
                                                        {isUploading === 'backCoverImage' ? (
                                                            <Loader2 className="animate-spin" size={32} />
                                                        ) : (
                                                            <>
                                                                <Upload size={32} />
                                                                <span className="text-sm font-medium">Clique para enviar imagem (A4 Vertical)</span>
                                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'backCoverImage')} />
                                                            </>
                                                        )}
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Background Image Upload */}
                                    {activeImageSection === 'background' && (
                                        <div className="space-y-4 mt-4 pb-8 animate-fade-in">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-bold text-zinc-800 flex items-center gap-2">
                                                    <Image size={18} className="text-blue-500" />
                                                    Fundo das Páginas
                                                </h3>
                                                {localTexts.backgroundImage && (
                                                    <button
                                                        onClick={() => handleRemoveImage('backgroundImage')}
                                                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                                                    >
                                                        <Trash2 size={12} /> Remover
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-xs text-zinc-500 -mt-2">Substitui o Cabeçalho e Rodapé padrão em todas as páginas de conteúdo.</p>

                                            <div className={`relative w-full aspect-[21/29.7] rounded-lg border-2 border-dashed ${localTexts.backgroundImage ? 'border-transparent' : 'border-zinc-300 hover:border-blue-400'} flex flex-col items-center justify-center transition-all bg-zinc-50 overflow-hidden group`}>
                                                {localTexts.backgroundImage ? (
                                                    <>
                                                        <img src={localTexts.backgroundImage} alt="Fundo" className="absolute inset-0 w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <label className="cursor-pointer bg-white text-zinc-800 px-4 py-2 rounded-full font-bold text-sm shadow-lg hover:scale-105 transition-transform">
                                                                Trocar Imagem
                                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'backgroundImage')} />
                                                            </label>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <label className="cursor-pointer flex flex-col items-center gap-2 p-8 text-zinc-400 hover:text-blue-500 w-full h-full justify-center">
                                                        {isUploading === 'backgroundImage' ? (
                                                            <Loader2 className="animate-spin" size={32} />
                                                        ) : (
                                                            <>
                                                                <Upload size={32} />
                                                                <span className="text-sm font-medium">Clique para enviar imagem (Fundo A4)</span>
                                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'backgroundImage')} />
                                                            </>
                                                        )}
                                                    </label>
                                                )}
                                            </div>


                                        </div>
                                    )}
                                </div>

                                {/* Margin Configuration (Always Visible in Images Tab) */}
                                <div className="mt-8 pt-6 border-t font-sans animate-fade-in">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="font-bold text-zinc-800 flex items-center gap-2 text-sm">
                                            <SlidersHorizontal size={18} className="text-blue-500" />
                                            Margem do Conteúdo (Páginas Internas)
                                        </label>
                                        <span className="text-sm font-mono bg-zinc-100 px-2 py-1 rounded text-zinc-600 border border-zinc-200">
                                            {localTexts.margin || 40}px
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mb-4">Ajuste a margem lateral para encaixar o texto caso seu fundo tenha bordas.</p>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={localTexts.margin || 40}
                                        onChange={(e) => setLocalTexts(prev => ({ ...prev, margin: parseInt(e.target.value) }))}
                                        className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                                        <span>0px</span>
                                        <span>50px</span>
                                        <span>100px</span>
                                    </div>
                                </div>
                            </>
                        ) : activeTab === 'institutional' ? (
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
