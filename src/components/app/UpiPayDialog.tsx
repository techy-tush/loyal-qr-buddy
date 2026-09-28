import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitUpiReference } from "@/lib/billing.functions";
import { qrDataUrl } from "@/lib/qr";

export type UpiPayment = {
  paymentId: string;
  amount: number;
  planName: string;
  upiId: string;
  payee: string;
  upiUrl: string;
};

export function UpiPayDialog({
  payment,
  onClose,
  onSubmitted,
}: {
  payment: UpiPayment | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [utr, setUtr] = useState("");
  const submitFn = useServerFn(submitUpiReference);

  useEffect(() => {
    setUtr("");
    setQr(null);
    if (payment) qrDataUrl(payment.upiUrl).then(setQr).catch(() => setQr(null));
  }, [payment]);

  const submit = useMutation({
    mutationFn: () => submitFn({ data: { paymentId: payment!.paymentId, utr } }),
    onSuccess: () => {
      toast.success("Thanks! Your plan will be activated once we confirm the payment.");
      onSubmitted();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={Boolean(payment)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pay ₹{payment?.amount.toLocaleString("en-IN")} by UPI</DialogTitle>
          <DialogDescription>{payment?.planName} plan · to {payment?.payee}</DialogDescription>
        </DialogHeader>
        {payment ? (
          <div className="space-y-4">
            {qr ? <img src={qr} alt="UPI payment QR" className="mx-auto size-52 rounded-md border border-border" /> : null}
            <p className="text-center text-xs text-muted-foreground">Scan with any UPI app (GPay, PhonePe, Paytm)</p>
            <Button asChild className="h-11 w-full">
              <a href={payment.upiUrl}><Smartphone className="size-4" /> Open UPI app</a>
            </Button>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-primary"
              onClick={() => navigator.clipboard.writeText(payment.upiId).then(() => toast.success("UPI ID copied"))}
            >
              <Copy className="size-4" /> {payment.upiId}
            </button>
            <form
              className="space-y-2 border-t border-border pt-4"
              onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}
            >
              <Label htmlFor="utr">After paying, enter the UPI reference / UTR number</Label>
              <Input id="utr" value={utr} inputMode="numeric" placeholder="e.g. 412345678901" onChange={(e) => setUtr(e.target.value.replace(/\s/g, ""))} />
              <Button type="submit" variant="secondary" className="w-full" disabled={submit.isPending || utr.length < 6}>
                {submit.isPending ? "Sending…" : "I have paid"}
              </Button>
            </form>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
