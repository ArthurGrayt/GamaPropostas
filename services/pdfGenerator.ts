import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { PDFDocument, rgb, StandardFonts, PDFName, PDFString } from 'pdf-lib';
import { EnrichedProposal, EnrichedItem } from '../types';
import { logAction } from './logger';

// --- Constants ---
const PRIMARY_COLOR = '#07889B';
const MARGIN = 40;

// --- Interfaces ---
interface ModuleConfig {
  id: number;
  title: string;
  items: EnrichedItem[];
}

export interface PdfOptions {
  companyNameType: 'NOME' | 'RAZAO_SOCIAL' | 'NOME_FANTASIA';
  customCompanyName?: string;
  moduleObservations?: Record<string, string>;
  showItemObservations?: boolean;
  customIntro?: string;
  customFooter?: string;
  customHeaderTitle?: string;
  customProposalPrefix?: string;
  customTableHeaders?: { col1: string; col2: string; col3: string };
  customObservationLabel?: string;
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
  customCoverUrl?: string;
  customBackgroundUrl?: string;
  customBackCoverUrl?: string;
  customMargin?: number;
  customMarginTop?: number;
  customMarginBottom?: number;

  customModuleTitles?: Record<string, string>;
  footer?: string;
}

// Helper to fetch and convert image to Base64 for jsPDF
async function fetchImageToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// --- PDF Builder Class (Dynamic Content Only) ---
class DynamicContentBuilder {
  private doc: jsPDF;
  private proposal: EnrichedProposal;
  private pageLabels: Map<number, string> = new Map();
  private moduleObservations: Record<string, string> = {};
  private showItemObservations: boolean = false;
  private customIntro?: string;
  private customFooter?: string;
  private customHeaderTitle?: string;
  private customProposalPrefix?: string;
  private customTableHeaders?: { col1: string; col2: string; col3: string };

  private customObservationLabel?: string;
  private customBackgroundBase64?: string;
  private margin: number;
  private marginTop: number;
  private marginBottom: number;

  constructor(proposal: EnrichedProposal, options: PdfOptions, customBackgroundBase64?: string) {
    this.doc = new jsPDF('p', 'pt', 'a4');
    this.proposal = proposal;
    this.moduleObservations = options.moduleObservations || {};
    this.showItemObservations = options.showItemObservations || false;
    this.customIntro = options.customIntro;
    this.customFooter = options.footer;
    this.customHeaderTitle = options.customHeaderTitle;
    this.customProposalPrefix = options.customProposalPrefix;
    this.customTableHeaders = options.customTableHeaders;
    this.customObservationLabel = options.customObservationLabel;

    // Assign module intros
    (this as any).introExames = options.introExames;
    (this as any).introDocumentos = options.introDocumentos;
    (this as any).introEsocial = options.introEsocial;
    (this as any).introTreinamentos = options.introTreinamentos;

    (this as any).introServicosSST = options.introServicosSST;
    (this as any).customModuleTitles = options.customModuleTitles || {};
    this.customBackgroundBase64 = customBackgroundBase64;
    this.margin = options.customMargin !== undefined ? options.customMargin : MARGIN;
    this.marginTop = options.customMarginTop !== undefined ? options.customMarginTop : MARGIN;
    this.marginBottom = options.customMarginBottom !== undefined ? options.customMarginBottom : MARGIN;

    // Monkey-patch addPage to always draw background (fixes autoTable pages)
    const originalAddPage = this.doc.addPage.bind(this.doc);
    (this.doc as any).addPage = (...args: any[]) => {
      const result = originalAddPage.apply(this.doc, args);
      this.drawBackground();
      return result;
    };
  }

  private drawBackground() {
    if (this.customBackgroundBase64) {
      const width = this.doc.internal.pageSize.getWidth();
      const height = this.doc.internal.pageSize.getHeight();
      try {
        this.doc.addImage(this.customBackgroundBase64, 'PNG', 0, 0, width, height);
      } catch (e) {
        // Fallback if format is not detected or supported, try JPEG
        try {
          this.doc.addImage(this.customBackgroundBase64, 'JPEG', 0, 0, width, height);
        } catch (e2) {
          console.warn("Could not add background image", e2);
        }
      }
    }
  }

  public build(): Uint8Array {
    // We start generating content. 
    // Note: We don't generate Cover (Pg1) or Intro (Pg2) here anymore.
    // We start directly with Modules.

    // However, jsPDF starts with 1 page. We will use this page for the first module.

    let currentPageNumber = 3; // The first module page will be Page 3 in the final doc

    // Draw Background on the very first page of this doc (which corresponds to Page 3)
    this.drawBackground();

    // Define modules order and Names
    const modules: { title: string; searchKeywords: string[] }[] = [
      { title: 'EXAMES', searchKeywords: ['exame', 'clinico', 'complementar'] },
      { title: 'DOCUMENTOS', searchKeywords: ['documento', 'pgr', 'pcmb'] },
      { title: 'eSOCIAL', searchKeywords: ['esocial'] },
      { title: 'TREINAMENTOS', searchKeywords: ['treinamento', 'curso'] },
      { title: 'SERVIÇOS SST', searchKeywords: ['sst', 'consultoria', 'pericia', 'visita'] }
    ];

    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const moduleConfigs: ModuleConfig[] = modules.map((m, index) => {

      const items = this.proposal.itens.filter(item => {
        const modName = item.modulo?.nome ? normalize(item.modulo.nome) : '';
        const procName = item.procedimento?.nome ? normalize(item.procedimento.nome) : '';
        const isEsocialItem = modName.includes('esocial') || procName.includes('esocial');

        // Logic for eSOCIAL module: Include if it is explicitly an eSocial item
        if (m.title === 'eSOCIAL') {
          return isEsocialItem;
        }

        // Logic for DOCUMENTOS module: Exclude if it is an eSocial item, otherwise standard check
        if (m.title === 'DOCUMENTOS') {
          if (isEsocialItem) return false;
        }

        // Standard check for other modules (or Documentos without eSocial items)
        const targetName = normalize(m.title);
        if (modName.includes(targetName) || targetName.includes(modName)) return true;
        return m.searchKeywords.some(k => modName.includes(k));
      });

      return {
        id: index,
        title: m.title,
        items: items
      };
    }).filter(m => m.items.length > 0);

    // If no modules, we still return a blank PDF (but this shouldn't happen in valid proposals)
    if (moduleConfigs.length === 0) {
      return new Uint8Array(this.doc.output('arraybuffer'));
    }

    moduleConfigs.forEach((mod, index) => {
      if (index > 0) {
        this.doc.addPage();
      }
      this.drawModule(mod, currentPageNumber, index === 0);
      currentPageNumber++;
    });

    // Apply Footers to the dynamic pages
    this.applyFooters();

    return new Uint8Array(this.doc.output('arraybuffer'));
  }

  private drawModule(module: ModuleConfig, basePageNumber: number, isFirstModule: boolean): void {
    const startPage = this.doc.getNumberOfPages();
    this.pageLabels.set(startPage, basePageNumber.toString());
    const pageWidth = this.doc.internal.pageSize.width;

    // START Y logic based on Margin Top
    // If it's the very first page (Page 3), we might want a bit more space or exactly margin top
    let yPos = this.marginTop + 20;

    // "O que será feito :" - Only on the very first dynamic page (Page 3)
    if (isFirstModule) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(16);
      this.doc.setTextColor('#000000');
      this.doc.text(this.customHeaderTitle || 'O que será feito :', this.margin, yPos);
      yPos += 40;
    } else {
      // Just margin top for subsequent modules?
      // Actually if we add a new page manually, y resets to margin top?
      // Wait, 'yPos' here determines where we START drawing on THIS page.
      // If we called addPage, we should reset yPos to marginTop.
      yPos = this.marginTop + 20;
    }

    // Module Title (Centered "PROPOSTA [NOME]")
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(14);
    this.doc.setTextColor('#000000');

    // Check for custom title for this specific module
    const customTitle = (this as any).customModuleTitles?.[module.title];
    const prefix = this.customProposalPrefix !== undefined ? this.customProposalPrefix : 'PROPOSTA';

    // Use custom title if exists, otherwise fallback to Default Prefix + Module Title
    const fullTitle = customTitle !== undefined ? customTitle : (prefix ? `${prefix} ${module.title}` : module.title);

    this.doc.text(fullTitle, pageWidth / 2, yPos, { align: 'center' });
    yPos += 20;

    // Client Name (Centered)
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(12);
    this.doc.text(this.proposal.cliente.nome.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
    yPos += 30;

    // Intro Text Selection Logic
    let introText = '';

    // Normalize module title to find matching intro
    const titleUpper = module.title.toUpperCase();

    // Explicit Mapping based on what we have in Options
    if (titleUpper.includes('EXAME')) {
      introText = ((this as any).introExames) || ((this as any).customIntro) || '';
      if (!introText && !((this as any).introExames)) {
        introText = "A seguir, tem-se os valores dos principais exames que podem estar atrelados a algum cargo na empresa, não implicando na necessidade de contratação de todos eles, mas somente aqueles que forem necessários de acordo com o PCMSO da empresa.\n\n" +
          "Todos os exames são realizados em nosso espaço da Clínica Gama Center, incluindo coleta de material para exames laboratoriais, exame toxicológico e outros exames complementares, com destaque ao Raio-X. Priorizamos a otimização atendimento a fim de se reduzir o tempo necessário para o trabalhador retornar à empresa.\n\n" +
          "Estes são os valores dos principais exames que podem estar atrelados a algum cargo na empresa, não implicando na necessidade de contratação de todos eles, mas somente daqueles que forem demandados de acordo com o PCMSO da empresa.";
      }
    } else if (titleUpper.includes('DOCUMENTO')) {
      introText = (this as any).introDocumentos || '';
    } else if (titleUpper.includes('ESOCIAL')) {
      introText = (this as any).introEsocial || '';
    } else if (titleUpper.includes('TREINAMENTO')) {
      introText = (this as any).introTreinamentos || '';
    } else if (titleUpper.includes('SST') || titleUpper.includes('SERVIÇOS')) {
      introText = (this as any).introServicosSST || '';
    }

    if (introText) {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(10);
      this.doc.setTextColor('#333333');

      const splitText = this.doc.splitTextToSize(introText, pageWidth - (this.margin * 2));
      this.doc.text(splitText, this.margin, yPos);
      const textHeight = this.doc.getTextDimensions(splitText).h;
      yPos += textHeight + 20;
    }

    // Table Data
    const tableBody = module.items.map((item, index) => {
      let description = item.procedimento?.nome || 'Item sem nome';
      if (this.showItemObservations && item.observacao) {
        description += `\n${this.customObservationLabel || 'Observação:'} ${item.observacao}`;
      }
      return [
        (index + 1).toString().padStart(2, '0'),
        description,
        (item.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ];
    });

    // Draw Table
    const headers = [
      this.customTableHeaders?.col1 || 'ITEM',
      this.customTableHeaders?.col2 || 'DESCRIÇÃO DO DOCUMENTO',
      this.customTableHeaders?.col3 || 'VALOR UNITÁRIO'
    ];

    (this.doc as any).autoTable({
      startY: yPos,
      head: [headers],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: '#EAEAEA', textColor: '#333333', fontStyle: 'bold', lineColor: '#CCCCCC', lineWidth: 0.1 },
      styles: { fontSize: 10, cellPadding: 8, valign: 'middle', lineColor: '#CCCCCC', lineWidth: 0.1, textColor: '#333333' },
      columnStyles: {
        0: { width: 40, halign: 'center' },
        1: {},
        2: { width: 100, halign: 'right' }
      },
      // IMPORTANT: Bottom margin ensures table breaks page automatically if not enough space
      margin: { left: this.margin, right: this.margin, top: this.marginTop, bottom: this.marginBottom + 20 },
      didDrawPage: (data: any) => {
        const currentPage = this.doc.getNumberOfPages();
        if (currentPage > startPage) {
          const suffixIndex = currentPage - startPage - 1;
          const suffix = String.fromCharCode(65 + suffixIndex);
          this.pageLabels.set(currentPage, `${basePageNumber}-${suffix}`);
        }
      }
    });

    // Draw Module Observation if exists
    // We get the final y position from autoTable
    const finalY = (this.doc as any).lastAutoTable.finalY + 20;
    const obsText = this.moduleObservations[module.title];
    let currentY: number;

    if (obsText && obsText.trim() !== '') {
      // Check for page break if needed (simple check)
      const pageHeight = this.doc.internal.pageSize.height;
      if (finalY > pageHeight - this.marginBottom - 50) {
        this.doc.addPage();
        // Reset Y for new page
        currentY = this.marginTop + 20;
      } else {
        currentY = finalY;
      }

      // If we reset, finalY is irrelevant, we use currentY.

      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(10);
      this.doc.setTextColor('#333333');
      this.doc.text(this.customObservationLabel || 'Observação:', this.margin, currentY);
      currentY += 15;

      this.doc.setFont('helvetica', 'normal');
      const splitObs = this.doc.splitTextToSize(obsText, pageWidth - (this.margin * 2));
      this.doc.text(splitObs, this.margin, currentY);
    }
  }

  private applyFooters(): void {
    // We remove the restriction: "if (this.customBackgroundBase64) return;" 
    // to allow footers even with custom backgrounds as requested.

    const localTotalPages = this.doc.getNumberOfPages();
    // Assuming Cover (1) + Intro (1) + Back Cover (1) = 3 fixed pages
    const GLOBAL_PAGE_OFFSET = 2; // Starts from Page 3
    // Total = Cover(1) + Intro(1) + Dynamic(N) + Back(1)
    const globalTotalPages = 2 + localTotalPages + 1;

    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;

    for (let i = 1; i <= localTotalPages; i++) {
      this.doc.setPage(i);

      // Calculate global page number
      const currentGlobalPage = i + GLOBAL_PAGE_OFFSET;

      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor('#888888');

      // Base Text
      let baseText = this.customFooter;
      if (!baseText || baseText.trim() === '') {
        baseText = 'Gama Center SST - 2025';
      }
      // Sanitize: Remove old placeholder if persisted
      baseText = baseText.replace(' - Página X', '');

      // Format: "Base Text - Página X de Y"
      const footerText = `${baseText} - Página ${currentGlobalPage} de ${globalTotalPages}`;

      const textWidth = this.doc.getStringUnitWidth(footerText) * this.doc.getFontSize() / this.doc.internal.scaleFactor;
      const x = (A4_WIDTH - textWidth) / 2;
      const y = A4_HEIGHT - 20;

      // Optional: Add a white background box for readability if using custom background
      if (this.customBackgroundBase64) {
        this.doc.setFillColor(255, 255, 255);
        // Small padding
        this.doc.rect(x - 4, y - 8, textWidth + 8, 10, 'F');
      }

      this.doc.text(footerText, x, y);
    }
  }
}



export const generateProposalPdf = async (proposal: EnrichedProposal, options?: PdfOptions): Promise<void> => {
  try {
    // RESOLVE COMPANY NAME
    let companyName = proposal.cliente.nome; // Default
    if (options) {
      if (options.companyNameType === 'RAZAO_SOCIAL' && proposal.cliente.razao_social) {
        companyName = proposal.cliente.razao_social;
      } else if (options.companyNameType === 'NOME_FANTASIA' && proposal.cliente.nome_fantasia) {
        companyName = proposal.cliente.nome_fantasia;
      }
    }

    console.log("Generating PDF with Options:", options);
    if (options) {
      console.log("Custom Cover URL:", options.customCoverUrl);
      console.log("Custom Background URL:", options.customBackgroundUrl);
      console.log("Custom Back Cover URL:", options.customBackCoverUrl);
    }

    // FILTER ITEMS - KEEP ONLY APPROVED
    // We create a shallow copy of the proposal with filtered items to avoid mutating the original UI state if passed by reference (though usually safe here)
    const approvedItems = proposal.itens.filter(i => i.status !== 'REJECTED');

    // If no items are approved, maybe we should warn? But requirement says "só deverá incluir itens marcados como aprovados".
    // We'll proceed with approved items only.

    const proposalForPdf: EnrichedProposal = {
      ...proposal,
      itens: approvedItems,
      // We might want to temporarily override the client name in the object if DynamicContentBuilder uses it directly
      cliente: {
        ...proposal.cliente,
        nome: companyName
      }
    };

    // 2. [DEPRECATED] Model PDF Loading - We now generate page 2 dynamically
    // const modelPdfBytes = ... 
    // const modelDoc = ...


    // 3. Generate Dynamic Content (Modules)
    // Prepare Background Base64 if needed
    let bgBase64 = undefined;
    if (options && options.customBackgroundUrl) {
      try {
        bgBase64 = await fetchImageToBase64(options.customBackgroundUrl);
      } catch (e) {
        console.error("Failed to fetch custom background", e);
      }
    }

    const dynamicBuilder = new DynamicContentBuilder(proposalForPdf, options || { companyNameType: 'NOME' }, bgBase64);
    const dynamicContentBytes = dynamicBuilder.build();
    const dynamicDoc = await PDFDocument.load(dynamicContentBytes);

    // 4. Create Final PDF
    const finalDoc = await PDFDocument.create();

    // 5. Assemble Pages

    // A. Front Cover (Image)
    let coverBytes: ArrayBuffer;
    if (options && options.customCoverUrl) {
      try {
        const res = await fetch(options.customCoverUrl);
        if (!res.ok) throw new Error('Failed to load custom cover');
        coverBytes = await res.arrayBuffer();
      } catch (e) {
        console.error("Using default cover due to error:", e);
        coverBytes = await fetch('/cover_page.jpg').then(res => res.arrayBuffer());
      }
    } else {
      coverBytes = await fetch('/cover_page.jpg').then(res => res.arrayBuffer());
    }

    let coverImage: any;
    try {
      // Try JPG first as default is JPG
      coverImage = await finalDoc.embedJpg(coverBytes);
    } catch {
      try {
        coverImage = await finalDoc.embedPng(coverBytes);
      } catch (e) {
        console.error("Could not embed cover image (format not supported?)", e);
        // Fallback to default if custom failed? Or just leave null?
        // If we are here, likely the custom image failed.
        // Let's rely on previous fallback logic or just error out.
      }
    }

    if (!coverImage) {
      // Fallback to default if custom failed completely logic above handles fetching bytes, 
      // but if bytes are invalid, we might need a safety net.
      // For now, assuming bytes are valid image data.
    }

    const coverPage = finalDoc.addPage();
    const { width: cpWidth, height: cpHeight } = coverPage.getSize();
    if (coverImage) {
      coverPage.drawImage(coverImage, { x: 0, y: 0, width: cpWidth, height: cpHeight });
    }

    // --- ADD CLICKABLE LINKS ---
    // Coordinates (Bottom-Left logic): [xMin, yMin, xMax, yMax]
    // A4 width: ~595, height: ~842. Bottom-left is (0,0).

    // 1. WhatsApp Link (Higher up in the footer)
    // Target: https://api.whatsapp.com/send?phone=5531971920766
    const waLink = finalDoc.context.register(
      finalDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [50, 115, 180, 145], // Reduced width to avoid overlapping the landline number
        Border: [0, 0, 0],
        A: {
          Type: 'Action',
          S: 'URI',
          URI: PDFString.of('https://api.whatsapp.com/send?phone=5531971920766'),
        },
      })
    );

    // 2. Instagram Link (Below the phone)
    // Target: https://www.instagram.com/gamacentersst/
    const igLink = finalDoc.context.register(
      finalDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [50, 80, 300, 110], // Generous hit box
        Border: [0, 0, 0],
        A: {
          Type: 'Action',
          S: 'URI',
          URI: PDFString.of('https://www.instagram.com/gamacentersst/'),
        },
      })
    );

    // B. Intro Page (Dynamic)
    // We generate a new PDF page(s) for the Institutional content
    const introDoc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = introDoc.internal.pageSize.width;
    const pageHeight = introDoc.internal.pageSize.height;

    // Background color (OPTIONAL - pure white for now)
    introDoc.setFillColor(255, 255, 255);
    introDoc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Draw Custom Background for Intro Page
    if (bgBase64) {
      try {
        introDoc.addImage(bgBase64, 'PNG', 0, 0, pageWidth, pageHeight);
      } catch (e) {
        try { introDoc.addImage(bgBase64, 'JPEG', 0, 0, pageWidth, pageHeight); } catch (e2) { }
      }
    }

    // --- Layout Logic ---
    // We should use options.customMargin here too.
    const customMargin = options?.customMargin !== undefined ? options.customMargin : MARGIN;
    const customMarginTop = options?.customMarginTop !== undefined ? options.customMarginTop : MARGIN;

    let y = customMarginTop + 20;

    // const leftColX = MARGIN; // Replacing
    const colWidth = (pageWidth - (customMargin * 3)) / 2; // split page roughly? Or vertically stacked?
    // User requested: "Quem somos", "Quem é nosso time", "Por que escolher". 
    // Usually these are vertically stacked or in a grid. Let's stack them for safety, or mimicking a specific layout.
    // Let's assume a clean vertical layout with proper spacing.

    // 1. Quem Somos
    introDoc.setFont('helvetica', 'bold');
    introDoc.setFontSize(14);
    introDoc.setTextColor(PRIMARY_COLOR);
    introDoc.text(options?.whoWeAreTitle || "QUEM SOMOS", customMargin, y);
    y += 20;

    introDoc.setFont('helvetica', 'normal');
    introDoc.setFontSize(10);
    introDoc.setTextColor('#333333');
    const whoText = options?.whoWeAreText || "";
    const splitWho = introDoc.splitTextToSize(whoText, pageWidth - (customMargin * 2));
    introDoc.text(splitWho, customMargin, y);
    y += introDoc.getTextDimensions(splitWho).h + 30;

    // 2. Quem é Nosso Time
    introDoc.setFont('helvetica', 'bold');
    introDoc.setFontSize(14);
    introDoc.setTextColor(PRIMARY_COLOR);
    introDoc.text(options?.ourTeamTitle || "Quem é nosso time?", customMargin, y);
    y += 20;

    // Team Columns Logic
    const colGap = 10;
    const teamColWidth = (pageWidth - (customMargin * 2) - colGap) / 2;
    const col2X = customMargin + teamColWidth + colGap;

    // Col 1 Header (Gray Bg)
    introDoc.setFillColor(234, 234, 234); // #EAEAEA
    introDoc.roundedRect(customMargin, y, teamColWidth, 20, 8, 8, 'F');
    introDoc.setFontSize(10);
    introDoc.setTextColor('#000000');
    introDoc.text(options?.teamCol1Title || "Segurança do trabalho", customMargin + 5, y + 14);

    // Col 2 Header (Gray Bg)
    introDoc.setFillColor(234, 234, 234);
    introDoc.roundedRect(col2X, y, teamColWidth, 20, 8, 8, 'F');
    introDoc.text(options?.teamCol2Title || "Medicina Ocupacional", col2X + 5, y + 14);
    y += 35; // Increased visual gap

    // Col 1 Content
    introDoc.setFont('helvetica', 'normal');
    introDoc.setFontSize(10);
    introDoc.setTextColor('#333333');
    const col1Text = options?.teamCol1Text || "";
    // Note: User input usually uses newlines. We should arguably split by newlines to ensure bullets align?
    // jsPDF splitTextToSize handles newlines well.
    const splitCol1 = introDoc.splitTextToSize(col1Text, teamColWidth - 10);
    introDoc.text(splitCol1, customMargin + 5, y);

    // Col 2 Content
    const col2Text = options?.teamCol2Text || "";
    const splitCol2 = introDoc.splitTextToSize(col2Text, teamColWidth - 10);
    introDoc.text(splitCol2, col2X + 5, y);

    // Calc height based on max of both cols
    const h1 = introDoc.getTextDimensions(splitCol1).h;
    const h2 = introDoc.getTextDimensions(splitCol2).h;
    y += Math.max(h1, h2) + 30;

    // 3. Por que escolher
    introDoc.setFont('helvetica', 'bold');
    introDoc.setFontSize(14);
    introDoc.setTextColor(PRIMARY_COLOR);
    introDoc.text(options?.whyChooseTitle || "Por que escolher a Gama Center?", customMargin, y);
    y += 20;

    introDoc.setFont('helvetica', 'normal');
    introDoc.setFontSize(10);
    introDoc.setTextColor('#333333');
    const whyText = options?.whyChooseText || "";
    const splitWhy = introDoc.splitTextToSize(whyText, pageWidth - (customMargin * 2));
    introDoc.text(splitWhy, customMargin, y);


    // Footer Logic for Intro Page (Skip if using custom background as it likely includes it)
    if (!bgBase64) {
      // Add Footer to this page too? Usually Intro pages have footers.
      const introLabel = "2"; // Usually Page 2
      introDoc.setFontSize(8);
      introDoc.setTextColor('#888888');
      const footerTxt = options?.customFooter !== undefined ? options.customFooter : `Gama Center SST - 2025 - Página ${introLabel}`;
      const txtWidth = introDoc.getStringUnitWidth(footerTxt) * 8 / introDoc.internal.scaleFactor;
      const fx = (pageWidth - txtWidth) / 2;
      const fy = pageHeight - 20;

      introDoc.text(footerTxt, fx, fy);
    }

    // Draw Footer on Intro Page (Page 2)
    const introFooterText = (options?.footer || 'Gama Center SST - 2025').replace(' - Página X', '');
    const totalPagesGlobal = 3 + dynamicDoc.getPageCount(); // Cover(1) + Intro(1) + Dynamic + Back(1)
    const introFooterFull = `${introFooterText} - Página 2 de ${totalPagesGlobal}`;

    introDoc.setFontSize(8);
    introDoc.setFont('helvetica', 'normal');
    introDoc.setTextColor('#888888');

    const introFooterWidth = introDoc.getStringUnitWidth(introFooterFull) * 8 / introDoc.internal.scaleFactor;
    const introX = (pageWidth - introFooterWidth) / 2;
    const introY = pageHeight - 20;

    if (bgBase64) {
      introDoc.setFillColor(255, 255, 255);
      introDoc.rect(introX - 4, introY - 8, introFooterWidth + 8, 10, 'F');
    }
    introDoc.text(introFooterFull, introX, introY);

    // Convert to PDF-Lib and Add
    const introBytes = new Uint8Array(introDoc.output('arraybuffer'));
    const introPdfDoc = await PDFDocument.load(introBytes);
    const [finalIntroPage] = await finalDoc.copyPages(introPdfDoc, [0]);
    finalDoc.addPage(finalIntroPage);


    // C. Dynamic Modules (Existing Logic)
    if (dynamicDoc.getPageCount() > 0) {
      const dynamicPages = await finalDoc.copyPages(dynamicDoc, dynamicDoc.getPageIndices());
      dynamicPages.forEach(page => finalDoc.addPage(page));
    }

    // D. Back Cover (Image)
    // D. Back Cover (Image)
    let backCoverBytes: ArrayBuffer;
    if (options && options.customBackCoverUrl) {
      try {
        const res = await fetch(options.customBackCoverUrl);
        if (!res.ok) throw new Error('Failed to load custom back cover');
        backCoverBytes = await res.arrayBuffer();
      } catch (e) {
        console.warn("Using default back cover due to error:", e);
        backCoverBytes = await fetch('/back_cover.png').then(res => res.arrayBuffer());
      }
    } else {
      backCoverBytes = await fetch('/back_cover.png').then(res => res.arrayBuffer());
    }

    // Attempt to detect if PNG or JPG
    let backCoverImage: any;
    try {
      // Optimistically try PNG first as default is PNG
      backCoverImage = await finalDoc.embedPng(backCoverBytes);
    } catch {
      // If fail, try JPG
      try {
        backCoverImage = await finalDoc.embedJpg(backCoverBytes);
      } catch (e) {
        console.error("Could not embed back cover", e);
        backCoverImage = null; // Skip if fails
      }
    }

    if (backCoverImage) {
      const backCoverPage = finalDoc.addPage();
      const { width: pgWidth, height: pgHeight } = backCoverPage.getSize();
      backCoverPage.drawImage(backCoverImage, {
        x: 0,
        y: 0,
        width: pgWidth,
        height: pgHeight,
      });
    }

    // 6. Save
    const pdfBytes = await finalDoc.save();
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `Proposta_${proposal.id}_${proposal.cliente.nome}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Log Export Action
    await logAction('EXPORT', `Exportou proposta #${proposal.id} em PDF`, { proposal_id: proposal.id });

  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Erro ao gerar PDF. Verifique se o arquivo 'model.pdf' está na pasta public e se o servidor está rodando.");
  }
};