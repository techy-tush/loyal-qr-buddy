import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadQrPng, downloadQrSvg, printQr, qrDataUrl, qrLink } from "@/lib/qr";

export function QrCard({ token, title }: { token: string; title: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const link = qrLink(token);

  useEffect(() => {
    let alive = true;
    qrDataUrl(link).then((url) => {
      if (alive) setDataUrl(url);
    });
    return () => {
      alive = false;
    };
  }, [link]);

  const fileName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="flex flex-col items-center gap-4">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`QR code for ${title}`}
          className="size-56 rounded-2xl border border-border bg-white p-2"
        />
      ) : (
        <Skeleton className="size-56 rounded-2xl" />
      )}
      <p className="break-all text-center text-xs text-muted-foreground">{link}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" onClick={() => downloadQrPng(link, `${fileName}.png`)}>
          <Download className="mr-1.5 size-4" /> PNG
        </Button>
        <Button size="sm" variant="outline" onClick={() => downloadQrSvg(link, `${fileName}.svg`)}>
          <Download className="mr-1.5 size-4" /> SVG
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!dataUrl}
          onClick={() => dataUrl && printQr(dataUrl, title)}
        >
          <Printer className="mr-1.5 size-4" /> Print
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            toast.success("Link copied");
          }}
        >
          <Copy className="mr-1.5 size-4" /> Copy link
        </Button>
      </div>
    </div>
  );
}
