import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function fillReceiptTemplate(templateBuffer, details) {
  const pdfDoc = await PDFDocument.load(templateBuffer);

  // Load & embed signature image
  const signatureBytes = await fetch('/signature/HR_Signature.png').then(res => res.arrayBuffer());
  const signatureImage = await pdfDoc.embedPng(signatureBytes);

  const pages = pdfDoc.getPages();
  const page = pages[0];
  const { height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Fill text
  page.drawText(details.receiptNo, {
    x: 90,
    y: height - 110,
    size: 10,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText(details.date, {
    x: 500,
    y: height - 110,
    size: 10,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText(details.studentName, {
    x: 160,
    y: height - 169,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText(details.courseName, {
    x: 160,
    y: height - 208,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText(details.courseFee, {
    x: 145,
    y: height - 245,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText(details.feeReceived, {
    x: 330,
    y: height - 245,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText(details.dueFee, {
    x: 495,
    y: height - 245,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  
  page.drawText(details.studentId, {
    x: 475  ,
    y: height - 169,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  // ✅ Draw the signature image
  page.drawImage(signatureImage, {
    x: 350,         // Adjust as per your template
    y: -50,          // Lower area for signature
    width: 300,
    height: 250,
  });

  return await pdfDoc.save();
}
