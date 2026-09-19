import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session";

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  category: string | null;
  logo_url: string | null;
  status: string;
  stamp_mode: string;
  onboarding_completed: boolean;
  google_review_url: string | null;
  instagram_url: string | null;
  whatsapp_number: string | null;
  stamp_cooldown_minutes: number;
  daily_stamp_limit: number;
  location_validation: boolean;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
};

export type Branch = { id: string; name: string; address: string | null; business_id: string };

type Ctx = {
  userId: string | null;
  businesses: Business[];
  business: Business | null;
  setBusinessId: (id: string) => void;
  branches: Branch[];
  branchId: string | null;
  setBranchId: (id: string | null) => void;
  role: "SUPER_ADMIN" | "BUSINESS_OWNER" | "BUSINESS_MANAGER" | "STAFF" | null;
  isSuperAdmin: boolean;
  loading: boolean;
  refetch: () => void;
};

const BusinessContext = createContext<Ctx | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useSessionUser();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);

  const businessesQuery = useQuery({
    queryKey: ["my-businesses", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Business[];
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (error) throw error;
      return data.map((r) => r.role as string);
    },
  });

  const staffQuery = useQuery({
    queryKey: ["my-staff-rows", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_staff")
        .select("business_id, role, branch_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  const businesses = businessesQuery.data ?? [];

  useEffect(() => {
    if (businesses.length === 0) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem("du_business_id") : null;
    const valid = businesses.find((b) => b.id === (businessId ?? stored));
    const next = valid?.id ?? businesses[0]!.id;
    if (next !== businessId) setBusinessId(next);
  }, [businesses, businessId]);

  const business = businesses.find((b) => b.id === businessId) ?? null;

  const branchesQuery = useQuery({
    queryKey: ["branches", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, address, business_id")
        .eq("business_id", businessId!)
        .order("created_at");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const isSuperAdmin = (rolesQuery.data ?? []).includes("SUPER_ADMIN");

  const role = useMemo<Ctx["role"]>(() => {
    if (isSuperAdmin) return "SUPER_ADMIN";
    if (!business || !user) return null;
    if (business.owner_id === user.id) return "BUSINESS_OWNER";
    const row = (staffQuery.data ?? []).find((s) => s.business_id === business.id);
    return (row?.role as Ctx["role"]) ?? null;
  }, [business, user, staffQuery.data, isSuperAdmin]);

  const value: Ctx = {
    userId: user?.id ?? null,
    businesses,
    business,
    setBusinessId: (id) => {
      setBusinessId(id);
      setBranchId(null);
      if (typeof window !== "undefined") localStorage.setItem("du_business_id", id);
    },
    branches: branchesQuery.data ?? [],
    branchId,
    setBranchId,
    role,
    isSuperAdmin,
    loading: businessesQuery.isLoading || rolesQuery.isLoading,
    refetch: () => {
      businessesQuery.refetch();
      branchesQuery.refetch();
    },
  };

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used inside BusinessProvider");
  return ctx;
}
