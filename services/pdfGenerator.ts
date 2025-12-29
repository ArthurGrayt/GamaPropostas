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

// --- PDF Builder Class (Dynamic Content Only) ---
class DynamicContentBuilder {
  private doc: jsPDF;
  private proposal: EnrichedProposal;
  private pageLabels: Map<number, string> = new Map();

  constructor(proposal: EnrichedProposal) {
    this.doc = new jsPDF('p', 'pt', 'a4');
    this.proposal = proposal;
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
      { title: 'TREINAMENTOS', searchKeywords: ['treinamento', 'curso'] },
      { title: 'SERVIÇOS SST', searchKeywords: ['sst', 'consultoria', 'pericia', 'visita'] }
    ];

    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const moduleConfigs: ModuleConfig[] = modules.map((m, index) => {
      const items = this.proposal.itens.filter(item => {
        if (!item.modulo?.nome) return false;
        const modName = normalize(item.modulo.nome);
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
      this.drawModule(mod, currentPageNumber);
      currentPageNumber++;
    });

    // Apply Footers to the dynamic pages
    this.applyFooters();

    return new Uint8Array(this.doc.output('arraybuffer'));
  }

  private drawModule(module: ModuleConfig, basePageNumber: number): void {
    const startPage = this.doc.getNumberOfPages();
    this.pageLabels.set(startPage, basePageNumber.toString());

    const pageWidth = this.doc.internal.pageSize.width;
    let yPos = MARGIN * 2;

    // "O que será feito :" - Only on the very first dynamic page (Page 3)
    if (basePageNumber === 3) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(16);
      this.doc.setTextColor('#000000');
      this.doc.text('O que será feito :', MARGIN, yPos);
      yPos += 40;
    }

    // Module Title (Centered "PROPOSTA [NOME]")
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(14);
    this.doc.setTextColor('#000000');
    this.doc.text(`PROPOSTA ${module.title}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 20;

    // Client Name (Centered)
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(12);
    this.doc.text(this.proposal.cliente.nome.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
    yPos += 30;

    // Intro Text - Only for EXAMES
    if (module.title === 'EXAMES') {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(10);
      this.doc.setTextColor('#333333');

      const introText = "A seguir, tem-se os valores dos principais exames que podem estar atrelados a algum cargo na empresa, não implicando na necessidade de contratação de todos eles, mas somente aqueles que forem necessários de acordo com o PCMSO da empresa.\n\n" +
        "Todos os exames são realizados em nosso espaço da Clínica Gama Center, incluindo coleta de material para exames laboratoriais, exame toxicológico e outros exames complementares, com destaque ao Raio-X. Priorizamos a otimização atendimento a fim de se reduzir o tempo necessário para o trabalhador retornar à empresa.\n\n" +
        "Estes são os valores dos principais exames que podem estar atrelados a algum cargo na empresa, não implicando na necessidade de contratação de todos eles, mas somente daqueles que forem demandados de acordo com o PCMSO da empresa.";

      const splitText = this.doc.splitTextToSize(introText, pageWidth - (MARGIN * 2));
      this.doc.text(splitText, MARGIN, yPos);
      const textHeight = this.doc.getTextDimensions(splitText).h;
      yPos += textHeight + 20;
    }

    // Table Data
    const tableBody = module.items.map((item, index) => [
      (index + 1).toString().padStart(2, '0'),
      item.procedimento?.nome || 'Item sem nome',
      (item.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);

    // Draw Table
    (this.doc as any).autoTable({
      startY: yPos,
      head: [['ITEM', 'DESCRIÇÃO DO DOCUMENTO', 'VALOR UNITÁRIO']],
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

      const footerText = `Gama Center SST - 2025 - Página ${pageLabel}`;
      const textWidth = this.doc.getStringUnitWidth(footerText) * this.doc.getFontSize() / this.doc.internal.scaleFactor;
      const x = (A4_WIDTH - textWidth) / 2;
      const y = A4_HEIGHT - 20;

      this.doc.setFillColor(255, 255, 255);
      this.doc.rect(x - 5, y - 8, textWidth + 10, 12, 'F');
      this.doc.text(footerText, x, y);
    }
  }
}

export const generateProposalPdf = async (proposal: EnrichedProposal): Promise<void> => {
  try {
    // 1. Fetch the Model PDF
    // Ensure the file is in the public folder and accessible via this URL
    const modelPdfBytes = await fetch('/model.pdf').then(res => {
      if (!res.ok) throw new Error('Failed to load model.pdf');
      return res.arrayBuffer();
    });

    // 2. Load Model PDF
    const modelDoc = await PDFDocument.load(modelPdfBytes);

    // 3. Generate Dynamic Content (Modules)
    const dynamicBuilder = new DynamicContentBuilder(proposal);
    const dynamicPdfBytes = dynamicBuilder.build();
    const dynamicDoc = await PDFDocument.load(dynamicPdfBytes);

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

    // Attach annotations to the page
    coverPage.node.set(PDFName.of('Annots'), finalDoc.context.obj([waLink, igLink]));
    // ---------------------------

    // B. Intro Page (From Model - Page 2, Index 1)
    const [introPage] = await finalDoc.copyPages(modelDoc, [1]);
    finalDoc.addPage(introPage);

    // C. Dynamic Modules
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