package com.ordermanagement.order.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.ordermanagement.order.entity.Order;
import com.ordermanagement.order.entity.OrderItem;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;

@Service
public class InvoicePdfService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");

    public byte[] generateInvoice(Order order) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 40, 40, 40, 40);
        PdfWriter.getInstance(doc, out);
        doc.open();

        Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20, new Color(30, 41, 59));
        Font subFont   = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(100, 116, 139));
        Font boldFont  = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, new Color(15, 23, 42));
        Font bodyFont  = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(30, 41, 59));

        Paragraph header = new Paragraph("TAX INVOICE", titleFont);
        doc.add(header);
        doc.add(new Paragraph("Order Management Store  |  support@ordermanagement.com", subFont));
        doc.add(Chunk.NEWLINE);

        // Order & Shipping metadata table
        PdfPTable meta = new PdfPTable(2);
        meta.setWidthPercentage(100);
        meta.setSpacingAfter(16f);

        PdfPCell left = new PdfPCell();
        left.setBorder(Rectangle.NO_BORDER);
        left.addElement(new Paragraph("Order Number: " + order.getOrderNumber(), boldFont));
        left.addElement(new Paragraph("Date: " + (order.getCreatedAt() != null ? order.getCreatedAt().format(DATE_FMT) : "-"), bodyFont));
        left.addElement(new Paragraph("Status: " + order.getStatus().name(), bodyFont));
        left.addElement(new Paragraph("Payment Method: " + order.getPaymentMethod(), bodyFont));
        meta.addCell(left);

        PdfPCell right = new PdfPCell();
        right.setBorder(Rectangle.NO_BORDER);
        right.addElement(new Paragraph("Bill & Ship To:", boldFont));
        right.addElement(new Paragraph(order.getShippingName(), bodyFont));
        right.addElement(new Paragraph(order.getShippingAddress(), bodyFont));
        right.addElement(new Paragraph(order.getShippingCity() + ", " + order.getShippingState() + " - " + order.getShippingPincode(), bodyFont));
        right.addElement(new Paragraph("Phone: " + order.getShippingPhone(), bodyFont));
        meta.addCell(right);

        doc.add(meta);

        // Items table
        PdfPTable table = new PdfPTable(new float[]{4f, 1.2f, 1.5f, 1.8f});
        table.setWidthPercentage(100);
        table.setSpacingAfter(16f);

        String[] headers = {"Product", "Qty", "Unit Price (INR)", "Line Total (INR)"};
        for (String h : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(h, boldFont));
            cell.setBackgroundColor(new Color(241, 245, 249));
            cell.setPadding(8f);
            table.addCell(cell);
        }

        for (OrderItem item : order.getItems()) {
            PdfPCell c1 = new PdfPCell(new Phrase(item.getProductName(), bodyFont));
            c1.setPadding(7f);
            table.addCell(c1);

            PdfPCell c2 = new PdfPCell(new Phrase(String.valueOf(item.getQuantity()), bodyFont));
            c2.setPadding(7f);
            c2.setHorizontalAlignment(Element.ALIGN_RIGHT);
            table.addCell(c2);

            PdfPCell c3 = new PdfPCell(new Phrase(item.getUnitPrice().toPlainString(), bodyFont));
            c3.setPadding(7f);
            c3.setHorizontalAlignment(Element.ALIGN_RIGHT);
            table.addCell(c3);

            PdfPCell c4 = new PdfPCell(new Phrase(item.getLineTotal().toPlainString(), bodyFont));
            c4.setPadding(7f);
            c4.setHorizontalAlignment(Element.ALIGN_RIGHT);
            table.addCell(c4);
        }
        doc.add(table);

        // Totals
        Paragraph totals = new Paragraph();
        totals.setAlignment(Element.ALIGN_RIGHT);
        totals.add(new Phrase("Subtotal: INR " + order.getSubtotal().toPlainString() + "\n", bodyFont));
        if (order.getDiscountTotal() != null && order.getDiscountTotal().signum() > 0) {
            totals.add(new Phrase("Discount: -INR " + order.getDiscountTotal().toPlainString() + "\n", bodyFont));
        }
        if (order.getCouponCode() != null && !order.getCouponCode().isBlank()) {
            totals.add(new Phrase("Coupon (" + order.getCouponCode() + "): -INR " + order.getCouponDiscount().toPlainString() + "\n", bodyFont));
        }
        totals.add(new Phrase("Grand Total: INR " + order.getTotal().toPlainString(), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12)));
        doc.add(totals);

        doc.add(Chunk.NEWLINE);
        Paragraph footer = new Paragraph("Thank you for shopping with Order Management Store!", subFont);
        footer.setAlignment(Element.ALIGN_CENTER);
        doc.add(footer);

        doc.close();
        return out.toByteArray();
    }
}
