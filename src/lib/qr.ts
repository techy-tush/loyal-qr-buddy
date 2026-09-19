import QRCode from "qrcode";

export function qrLink(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/qr/${token}`;
}

export async function qrDataUrl(value: string) {
  return QRCode.toDataURL(value, {
    width: 720,
    margin: 2,
    color: { dark: "#17231D", light: "#FFFFFF" },
  });
}

export async function qrSvg(value: string) {
  return QRCode.toString(value, {
    type: "svg",
    margin: 2,
    color: { dark: "#17231D", light: "#FFFFFF" },
  });
}

export function downloadFile(content: string, filename: string) {
  const a = document.createElement("a");
  a.href = content;
  a.download = filename;
  a.click();
}

export async function downloadQrPng(value: string, filename: string) {
  downloadFile(await qrDataUrl(value), filename);
}

export async function downloadQrSvg(value: string, filename: string) {
  const svg = await qrSvg(value);
  downloadFile(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, filename);
}

export function printQr(dataUrl: string, title: string) {
  const w = window.open("", "_blank", "width=600,height=700");
  if (!w) return;
  w.document.write(
    `<html><head><title>${title}</title></head><body style="font-family:sans-serif;text-align:center;padding:40px">` +
      `<h2>${title}</h2><img src="${dataUrl}" style="width:320px"/><p>Scan to join our loyalty program</p>` +
      `</body></html>`,
  );
  w.document.close();
  w.focus();
  w.print();
}
