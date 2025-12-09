import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

async function checkPdf() {
    try {
        const pdfBytes = fs.readFileSync('proposta_18_ DCT EXPRESS INFORMATICA LTDA_1763570102157.pdf');
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pageCount = pdfDoc.getPageCount();
        console.log(`Total Pages: ${pageCount}`);
    } catch (err) {
        console.error(err);
    }
}

checkPdf();
