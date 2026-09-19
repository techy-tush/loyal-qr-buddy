import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader, StatCard } from "@/components/app/AppShell";
import { getSecurityReport, runTenantIsolationTest } from "@/lib/security.functions";
import type { IsolationResult } from "@/lib/security.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ShieldCheck, ShieldAlert, Lock, CheckCircle2, XCircle, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/security")({
  component: SecurityPage,
  head: () => ({
    meta: [
      { title: "Security audit | Digital Udyam" },
      {
        name: "description",
        content:
          "Review every database table, its access rules, who can read or write it, and run a live tenant-isolation test.",
      },
      { property: "og:title", content: "Security audit | Digital Udyam" },
      {
        property: "og:description",
        content: "Database access rules and a live tenant-isolation test for Digital Udyam.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function RoleAccess({ privs }: { privs: string }) {
  if (!privs) return <span className="text-muted-foreground">No access</span>;
  const list = privs.split(", ");
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((p) => (
        <Badge key={p} variant="secondary" className="text-[10px] uppercase">
          {p === "SELECT" ? "read" : p.toLowerCase()}
        </Badge>
      ))}
    </div>
  );
}

function SecurityPage() {
  const reportFn = useServerFn(getSecurityReport);
  const testFn = useServerFn(runTenantIsolationTest);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<IsolationResult | null>(null);

  const report = useQuery({
    queryKey: ["security-report"],
    queryFn: () => reportFn({}),
    retry: false,
  });

  const runTest = useMutation({
    mutationFn: () => testFn({ data: {} }),
    onSuccess: (r) => {
      setResult(r as IsolationResult);
      const res = r as IsolationResult;
      if (res.failures === 0) toast.success("Tenant isolation test passed for every table.");
      else toast.error(`${res.failures} table(s) need attention.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tables = report.data?.tables ?? [];
  const policies = report.data?.policies ?? [];

  const filtered = useMemo(
    () => tables.filter((t) => t.table_name.includes(search.trim().toLowerCase())),
    [tables, search],
  );

  const policiesByTable = useMemo(() => {
    const map = new Map<string, typeof policies>();
    for (const p of policies) {
      const arr = map.get(p.table_name) ?? [];
      arr.push(p);
      map.set(p.table_name, arr);
    }
    return map;
  }, [policies]);

  const unprotected = tables.filter((t) => !t.rls_enabled || t.policy_count === 0);
  const anonReadable = tables.filter((t) => t.anon_privs.includes("SELECT"));

  if (report.isError) {
    return (
      <AppShell>
        <PageHeader title="Security audit" description="Database access rules and tenant isolation." />
        <Card className="max-w-xl">
          <CardContent className="space-y-2 p-8 text-center">
            <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="font-display text-lg font-semibold">Platform team only</h2>
            <p className="text-sm text-muted-foreground">
              This report is limited to platform administrators.
            </p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Security audit"
        description="Every table, its access rules, who can read or write it, and a live isolation test."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tables" value={report.isLoading ? "—" : tables.length} icon={ShieldCheck} />
        <StatCard label="Access rules" value={report.isLoading ? "—" : policies.length} icon={Lock} />
        <StatCard
          label="Tables without rules"
          value={report.isLoading ? "—" : unprotected.length}
          icon={ShieldAlert}
        />
        <StatCard
          label="Public-readable tables"
          value={report.isLoading ? "—" : anonReadable.length}
          icon={ShieldAlert}
        />
      </div>

      <Tabs defaultValue="tables" className="mt-6">
        <TabsList>
          <TabsTrigger value="tables">Tables &amp; access</TabsTrigger>
          <TabsTrigger value="policies">Access rules</TabsTrigger>
          <TabsTrigger value="isolation">Isolation test</TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="mt-4 space-y-4">
          <Input
            placeholder="Search tables…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Card>
            <CardContent className="p-0">
              {report.isLoading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Table</TableHead>
                        <TableHead>Protection</TableHead>
                        <TableHead>Rules</TableHead>
                        <TableHead>Business-scoped</TableHead>
                        <TableHead>Visitors (not signed in)</TableHead>
                        <TableHead>Signed-in users</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((t) => (
                        <TableRow key={t.table_name}>
                          <TableCell className="font-medium">{t.table_name}</TableCell>
                          <TableCell>
                            {t.rls_enabled ? (
                              <Badge className="bg-success/15 text-success hover:bg-success/15">
                                Protected
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Open</Badge>
                            )}
                          </TableCell>
                          <TableCell>{t.policy_count}</TableCell>
                          <TableCell>
                            {t.has_business_id ? (
                              <span className="text-success">Yes</span>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <RoleAccess privs={t.anon_privs} />
                          </TableCell>
                          <TableCell>
                            <RoleAccess privs={t.authenticated_privs} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="mt-4">
          <Card>
            <CardContent className="p-2 sm:p-4">
              {report.isLoading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <Accordion type="multiple">
                  {[...policiesByTable.entries()].map(([table, rows]) => (
                    <AccordionItem key={table} value={table}>
                      <AccordionTrigger className="text-sm">
                        <span className="font-medium">{table}</span>
                        <span className="ml-2 text-muted-foreground">{rows.length} rule(s)</span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        {rows.map((p) => (
                          <div key={p.policy_name} className="rounded-xl border p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{p.command}</Badge>
                              <span className="font-medium">{p.policy_name}</span>
                              <span className="text-xs text-muted-foreground">{p.roles}</span>
                            </div>
                            {p.using_expression && (
                              <p className="mt-2 break-words font-mono text-xs text-muted-foreground">
                                read/match: {p.using_expression}
                              </p>
                            )}
                            {p.check_expression && (
                              <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
                                write check: {p.check_expression}
                              </p>
                            )}
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="isolation" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Tenant isolation test</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Checks that visitors who are not signed in can read nothing, and that you can only
                  read rows belonging to your own businesses.
                </p>
              </div>
              <Button onClick={() => runTest.mutate()} disabled={runTest.isPending}>
                <Play className="mr-2 h-4 w-4" />
                {runTest.isPending ? "Running…" : "Run test"}
              </Button>
            </CardHeader>
            {result && (
              <CardContent className="space-y-4">
                <div
                  className={`rounded-xl border p-4 text-sm ${
                    result.failures === 0
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-destructive/40 bg-destructive/10 text-destructive"
                  }`}
                >
                  {result.failures === 0
                    ? `All ${result.checks.length} tables passed.`
                    : `${result.failures} of ${result.checks.length} tables need attention.`}
                  {result.isPlatformAdmin && (
                    <span className="ml-1 text-foreground/70">
                      You have platform-admin access, so wider visibility is expected and is not
                      counted as a failure.
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Table</TableHead>
                        <TableHead>Rows in total</TableHead>
                        <TableHead>Visible to visitors</TableHead>
                        <TableHead>Visible to you</TableHead>
                        <TableHead>Yours</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.checks.map((c) => (
                        <TableRow key={c.table}>
                          <TableCell className="font-medium">{c.table}</TableCell>
                          <TableCell>{c.totalRows}</TableCell>
                          <TableCell>{c.visibleToAnonymous}</TableCell>
                          <TableCell>{c.visibleToCaller}</TableCell>
                          <TableCell>{c.callerOwnRows}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {c.passed ? (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                              <span className="text-xs text-muted-foreground">{c.note}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
