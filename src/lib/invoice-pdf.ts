export type InvoiceRow = {
  invoice_number: string;
  created_at: string;
  item_name: string;
  validity: string | null;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  method: string;
  reference: string | null;
  status: string;
  billing: any;
  seller: any;
};

const d = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN") : "—");
const rs = (n: number) => `Rs. ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Builds and downloads the invoice PDF in the browser. */
export async function downloadInvoicePdf(inv: InvoiceRow) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const s = inv.seller ?? {};
  const b = inv.billing ?? {};
  let y = 56;
  doc.setFont("helvetica", "bold").setFontSize(20).text("TAX INVOICE".replace(s.gstin ? "" : "TAX ", ""), 48, y);
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text(`Invoice no: ${inv.invoice_number}`, 400, y - 6);
  doc.text(`Date: ${d(inv.created_at)}`, 400, y + 8);
  y += 36;
  doc.setFont("helvetica", "bold").text("From", 48, y);
  doc.text("Bill to", 320, y);
  doc.setFont("helvetica", "normal");
  const from = [s.name, s.address, s.gstin ? `GSTIN: ${s.gstin}` : "", s.email, s.phone].filter(Boolean);
  const to = [b.name, b.address, [b.city, b.state, b.pincode].filter(Boolean).join(", "), b.phone, b.email].filter(Boolean);
  from.forEach((l: string, i: number) => doc.text(doc.splitTextToSize(String(l), 240), 48, y + 16 + i * 14));
  to.forEach((l: string, i: number) => doc.text(doc.splitTextToSize(String(l), 230), 320, y + 16 + i * 14));
  y += 30 + Math.max(from.length, to.length) * 14 + 10;
  doc.setDrawColor(200).line(48, y, 547, y);
  y += 20;
  doc.setFont("helvetica", "bold").text("Description", 48, y).text("Period", 300, y).text("Amount", 480, y);
  doc.setFont("helvetica", "normal");
  y += 18;
  doc.text(`${inv.item_name}${inv.validity ? ` — ${inv.validity}` : ""}`, 48, y);
  doc.text(`${d(inv.period_start)} – ${d(inv.period_end)}`, 300, y);
  doc.text(rs(inv.amount), 480, y);
  y += 26;
  doc.line(48, y, 547, y);
  y += 18;
  const line = (k: string, v: string) => { doc.text(k, 340, y); doc.text(v, 480, y); y += 16; };
  if (Number(inv.discount) > 0) line("Discount", `- ${rs(inv.discount)}`);
  if (Number(inv.tax_amount) > 0) line(`Included GST (${inv.tax_rate}%)`, rs(inv.tax_amount));
  doc.setFont("helvetica", "bold");
  line("Total paid", rs(inv.total));
  doc.setFont("helvetica", "normal");
  y += 10;
  doc.text(`Payment method: ${inv.method}`, 48, y);
  doc.text(`Reference: ${inv.reference ?? "—"}`, 48, y + 14);
  doc.text(`Status: ${inv.status === "PAID" ? "Paid" : inv.status}`, 48, y + 28);
  doc.setFontSize(8).setTextColor(120).text("This is a computer generated invoice.", 48, 800);
  doc.save(`${inv.invoice_number}.pdf`);
}
