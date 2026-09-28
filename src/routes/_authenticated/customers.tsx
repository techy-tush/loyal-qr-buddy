import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Download, Search, Users } from "lucide-react";
import { AppShell, EmptyState, PageHeader } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers | Digital Udyam" },
      { name: "description", content: "Search, segment and grow your customer base." },
      { property: "og:title", content: "Customer CRM | Digital Udyam" },
      { property: "og:description", content: "Every visit, stamp and reward in one place." },
    ],
  }),
  component: () => (
    <AppShell>
      <CustomersPage />
    </AppShell>
  ),
});

const filters = [
  { key: "ALL", label: "All" },
  { key: "NEW", label: "New" },
  { key: "REPEAT", label: "Repeat" },
  { key: "INACTIVE", label: "Inactive" },
  { key: "BIRTHDAY", label: "Birthday" },
  { key: "ANNIVERSARY", label: "Anniversary" },
  { key: "VIP", label: "VIP" },
] as const;

const PAGE_SIZE = 20;

function CustomersPage() {
  const { business, branchId } = useBusiness();
  const businessId = business!.id;
  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("ALL");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(rawSearch.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [rawSearch]);

  const monthDay = useMemo(() => {
    const now = new Date();
    return `-${String(now.getMonth() + 1).padStart(2, "0")}-`;
  }, []);

  const query = useQuery({
    queryKey: ["customers", businessId, branchId, search, filter, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("customers")
        .select("id, full_name, phone, dob, anniversary, total_visits, last_visit_at, is_vip", {
          count: "exact",
        })
        .eq("business_id", businessId);

      if (branchId) q = q.eq("branch_id", branchId);
      if (search) q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      if (filter === "NEW") q = q.lte("total_visits", 1);
      if (filter === "REPEAT") q = q.gt("total_visits", 1);
      if (filter === "INACTIVE") q = q.lt("last_visit_at", thirtyDaysAgo);
      if (filter === "VIP") q = q.eq("is_vip", true);
      if (filter === "BIRTHDAY") q = q.like("dob", `%${monthDay}%`);
      if (filter === "ANNIVERSARY") q = q.like("anniversary", `%${monthDay}%`);

      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.count ?? 0;

  function exportVisibleRows() {
    if (rows.length === 0) return;
    const escape = (value: string | number | null) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      ["Name", "Phone", "DOB", "Anniversary", "Last visit", "Visits", "VIP"].map(escape).join(","),
      ...rows.map((customer) => [customer.full_name, customer.phone, customer.dob, customer.anniversary, customer.last_visit_at, customer.total_visits ?? 0, customer.is_vip ? "Yes" : "No"].map(escape).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `digital-udyam-customers-page-${page + 1}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader title="Customers" description="Your loyalty members and their activity." />

      <div className="mb-4 grid gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex">
        <div className="relative min-w-0 sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name or phone"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={exportVisibleRows} disabled={rows.length === 0} aria-label="Download visible customers as CSV"><Download className="size-4" /><span className="hidden sm:inline">Export CSV</span></Button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => {
                setFilter(f.key);
                setPage(0);
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Share your QR code to get your first customer."
        />
      ) : (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>DOB</TableHead>
                <TableHead>Anniversary</TableHead>
                <TableHead>Last visit</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link to="/customers/$customerId" params={{ customerId: c.id }} className="hover:underline">
                      {c.full_name}
                    </Link>
                  </TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>{c.dob ?? "—"}</TableCell>
                  <TableCell>{c.anniversary ?? "—"}</TableCell>
                  <TableCell>
                    {c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">{c.total_visits ?? 0}</TableCell>
                  <TableCell>
                    <StatusBadge visits={c.total_visits ?? 0} lastVisit={c.last_visit_at} vip={c.is_vip} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function StatusBadge({
  visits,
  lastVisit,
  vip,
}: {
  visits: number;
  lastVisit: string | null;
  vip: boolean | null;
}) {
  if (vip) return <Badge>VIP</Badge>;
  if (!lastVisit || new Date(lastVisit).getTime() < Date.now() - 30 * 86400000)
    return <Badge variant="secondary">Inactive</Badge>;
  if (visits > 1) return <Badge variant="outline">Repeat</Badge>;
  return <Badge variant="outline">New</Badge>;
}
