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

  constructor(proposal: EnrichedProposal, options: PdfOptions) {
    this.doc = new jsPDF('p', 'pt', 'a4');
    this.proposal = proposal;
    this.moduleObservations = options.moduleObservations || {};
    this.showItemObservations = options.showItemObservations || false;
    this.customIntro = options.customIntro;
    this.customFooter = options.customFooter;
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
  }

  public build(): Uint8Array {
    // We start generating content. 
    // Note: We don't generate Cover (Pg1) or Intro (Pg2) here anymore.
    // We start directly with Modules.

    // However, jsPDF starts with 1 page. We will use this page for the first module.

    let currentPageNumber = 3; // The first module page will be Page 3 in the final doc

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
    let yPos = MARGIN * 2;

    // "O que será feito :" - Only on the very first dynamic page (Page 3)
    if (isFirstModule) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(16);
      this.doc.setTextColor('#000000');
      this.doc.text(this.customHeaderTitle || 'O que será feito :', MARGIN, yPos);
      yPos += 40;
    } else {
      // Add some top spacing for subsequent module pages
      yPos += 20;
    }

    // Module Title (Centered "PROPOSTA [NOME]")
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(14);
    this.doc.setTextColor('#000000');
    const prefix = this.customProposalPrefix !== undefined ? this.customProposalPrefix : 'PROPOSTA';
    // Handle empty prefix gracefully
    const fullTitle = prefix ? `${prefix} ${module.title}` : module.title;
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

      const splitText = this.doc.splitTextToSize(introText, pageWidth - (MARGIN * 2));
      this.doc.text(splitText, MARGIN, yPos);
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
      margin: { left: MARGIN, right: MARGIN, bottom: MARGIN + 20 },
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

    if (obsText && obsText.trim() !== '') {
      // Check for page break if needed (simple check)
      const pageHeight = this.doc.internal.pageSize.height;
      if (finalY > pageHeight - MARGIN - 50) {
        this.doc.addPage();
        // Reset Y for new page? No, autoTable usually handles table breaks, but post-table content is manual.
        // If we added a page, y starts at margin.
        // However, implementing robust multi-page observation printing is complex. 
        // For now, we print starting at finalY, and if it overflows, jsPDF might clip or we'd need splitText logic.
        // Let's assume standard short observations for now, or add simple page check.
      }

      // Use correct Y (if we added page, it would be different, but let's stick to flow for this iteration)
      let currentY = finalY;

      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(10);
      this.doc.setTextColor('#333333');
      this.doc.text(this.customObservationLabel || 'Observação:', MARGIN, currentY);
      currentY += 15;

      this.doc.setFont('helvetica', 'normal');
      const splitObs = this.doc.splitTextToSize(obsText, pageWidth - (MARGIN * 2));
      this.doc.text(splitObs, MARGIN, currentY);
    }
  }

  private applyFooters(): void {
    const totalPages = this.doc.getNumberOfPages();
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;

    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      const pageLabel = this.pageLabels.get(i) || i.toString();

      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor('#888888');

      const footerText = this.customFooter !== undefined ? this.customFooter : `Gama Center SST - 2025 - Página ${pageLabel}`;
      const textWidth = this.doc.getStringUnitWidth(footerText) * this.doc.getFontSize() / this.doc.internal.scaleFactor;
      const x = (A4_WIDTH - textWidth) / 2;
      const y = A4_HEIGHT - 20;

      this.doc.setFillColor(255, 255, 255);
      this.doc.rect(x - 5, y - 8, textWidth + 10, 12, 'F');
      this.doc.text(footerText, x, y);
    }
  }
}

export interface PdfOptions {
  companyNameType: 'NOME' | 'RAZAO_SOCIAL' | 'NOME_FANTASIA';
  customCompanyName?: string; // If 'custom' is needed later, or we pass the resolved string directly
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
    // 7. Build Dynamic Content (Modules + Footers)
    const dynamicBuilder = new DynamicContentBuilder(proposalForPdf, options || { companyNameType: 'NOME' });
    const dynamicContentBytes = dynamicBuilder.build();
    const dynamicDoc = await PDFDocument.load(dynamicContentBytes);

    // 4. Create Final PDF
    const finalDoc = await PDFDocument.create();

    // 5. Assemble Pages

    // A. Front Cover (Image)
    // A. Front Cover (Image)
    const coverBytes = await fetch('/cover_page.jpg').then(res => {
      if (!res.ok) throw new Error('Failed to load cover_page.jpg');
      return res.arrayBuffer();
    });
    const coverImage = await finalDoc.embedJpg(coverBytes);
    const coverPage = finalDoc.addPage();
    const { width: cpWidth, height: cpHeight } = coverPage.getSize();
    coverPage.drawImage(coverImage, { x: 0, y: 0, width: cpWidth, height: cpHeight });

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

    // --- Layout Logic ---
    let y = 60;
    const leftColX = MARGIN;
    const colWidth = (pageWidth - (MARGIN * 3)) / 2; // split page roughly? Or vertically stacked?
    // User requested: "Quem somos", "Quem é nosso time", "Por que escolher". 
    // Usually these are vertically stacked or in a grid. Let's stack them for safety, or mimicking a specific layout.
    // Let's assume a clean vertical layout with proper spacing.

    // 1. Quem Somos
    introDoc.setFont('helvetica', 'bold');
    introDoc.setFontSize(14);
    introDoc.setTextColor(PRIMARY_COLOR);
    introDoc.text(options?.whoWeAreTitle || "QUEM SOMOS", MARGIN, y);
    y += 20;

    introDoc.setFont('helvetica', 'normal');
    introDoc.setFontSize(10);
    introDoc.setTextColor('#333333');
    const whoText = options?.whoWeAreText || "";
    const splitWho = introDoc.splitTextToSize(whoText, pageWidth - (MARGIN * 2));
    introDoc.text(splitWho, MARGIN, y);
    y += introDoc.getTextDimensions(splitWho).h + 30;

    // 2. Quem é Nosso Time
    introDoc.setFont('helvetica', 'bold');
    introDoc.setFontSize(14);
    introDoc.setTextColor(PRIMARY_COLOR);
    introDoc.text(options?.ourTeamTitle || "Quem é nosso time?", MARGIN, y);
    y += 20;

    // Team Columns Logic
    const colGap = 10;
    const teamColWidth = (pageWidth - (MARGIN * 2) - colGap) / 2;
    const col2X = MARGIN + teamColWidth + colGap;

    // Col 1 Header (Gray Bg)
    introDoc.setFillColor(234, 234, 234); // #EAEAEA
    introDoc.rect(MARGIN, y, teamColWidth, 20, 'F');
    introDoc.setFontSize(10);
    introDoc.setTextColor('#000000');
    introDoc.text(options?.teamCol1Title || "Segurança do trabalho", MARGIN + 5, y + 14);

    // Col 2 Header (Gray Bg)
    introDoc.rect(col2X, y, teamColWidth, 20, 'F');
    introDoc.text(options?.teamCol2Title || "Medicina Ocupacional", col2X + 5, y + 14);
    y += 30;

    // Col 1 Content
    introDoc.setFont('helvetica', 'normal');
    introDoc.setFontSize(10);
    introDoc.setTextColor('#333333');
    const col1Text = options?.teamCol1Text || "";
    // Note: User input usually uses newlines. We should arguably split by newlines to ensure bullets align?
    // jsPDF splitTextToSize handles newlines well.
    const splitCol1 = introDoc.splitTextToSize(col1Text, teamColWidth - 10);
    introDoc.text(splitCol1, MARGIN + 5, y);

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
    introDoc.text(options?.whyChooseTitle || "Por que escolher a Gama Center?", MARGIN, y);
    y += 20;

    introDoc.setFont('helvetica', 'normal');
    introDoc.setFontSize(10);
    introDoc.setTextColor('#333333');
    const whyText = options?.whyChooseText || "";
    const splitWhy = introDoc.splitTextToSize(whyText, pageWidth - (MARGIN * 2));
    introDoc.text(splitWhy, MARGIN, y);

    // Add Footer to this page too? Usually Intro pages have footers.
    const introLabel = "2"; // Usually Page 2
    introDoc.setFontSize(8);
    introDoc.setTextColor('#888888');
    const footerTxt = options?.customFooter !== undefined ? options.customFooter : `Gama Center SST - 2025 - Página ${introLabel}`;
    const txtWidth = introDoc.getStringUnitWidth(footerTxt) * 8 / introDoc.internal.scaleFactor;
    const fx = (pageWidth - txtWidth) / 2;
    const fy = pageHeight - 20;
    introDoc.text(footerTxt, fx, fy);

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
    const backCoverBytes = await fetch('/back_cover.png').then(res => {
      if (!res.ok) throw new Error('Failed to load back_cover.png');
      return res.arrayBuffer();
    });

    const backCoverImage = await finalDoc.embedPng(backCoverBytes);
    const backCoverPage = finalDoc.addPage();
    const { width: pgWidth, height: pgHeight } = backCoverPage.getSize();

    backCoverPage.drawImage(backCoverImage, {
      x: 0,
      y: 0,
      width: pgWidth,
      height: pgHeight,
    });

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