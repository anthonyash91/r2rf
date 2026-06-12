import { createFileRoute } from "@tanstack/react-router";
import { requireAnalyticsAdminBeforeLoad } from "@/lib/admin-guards";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getMyFacilityValue } from "@/lib/user-signup.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Building2, Users as UsersIcon } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FacilityCombobox } from "@/components/FacilityCombobox";
import { listAllFacilities } from "@/lib/facilities.functions";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { UsageReportView } from "@/components/analytics/AnalyticsUsageReport";
import { FacilityComparisonSection, FacilityReportTab } from "@/components/analytics/AnalyticsFacilityView";
import { UsersReportTab } from "@/components/analytics/AnalyticsUserReport";

export const Route = createFileRoute("/admin/analytics")({
  beforeLoad: requireAnalyticsAdminBeforeLoad,
  component: AdminReportsPage,
});

function AdminReportsPage() {
  const { isFacilityUser, user } = useAuth();
  const fetchMyFacility = useServerFn(getMyFacilityValue);
  const { data: myFacilityData } = useQuery({
    queryKey: ["my-facility", user?.id],
    enabled: isFacilityUser && !!user?.id,
    staleTime: Infinity,
    queryFn: () => fetchMyFacility(),
  });
  const myFacilityValue = isFacilityUser ? (myFacilityData?.facility ?? null) : null;

  const [tab, setTab] = useState<"overall" | "facility" | "user">("overall");
  const [facilityKey, setFacilityKey] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<{ value: string; label: string } | null>(null);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [userKey, setUserKey] = useState(0);
  const [selectedUserFacility, setSelectedUserFacility] = useState<{ value: string; label: string } | null>(null);
  const [activeUser, setActiveUser] = useState<{ userId: string; name: string; pin?: string | null } | null>(null);

  const fetchFacilities = useServerFn(listAllFacilities);
  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchFacilities(),
    enabled: pickerOpen || userPickerOpen,
  });
  const facilities = facilitiesQuery.data?.facilities ?? [];

  const openFacilityPicker = () => {
    setUserPickerOpen(false);
    setPickerOpen(true);
  };
  const openUserPicker = () => {
    setPickerOpen(false);
    setUserPickerOpen(true);
  };

  const headerTitle =
    tab === "user" && activeUser
      ? "Reports > User Report"
      : tab === "overall"
        ? "Reports > Overall"
        : tab === "facility" && selectedFacility
          ? `Reports > ${selectedFacility.label}`
          : tab === "user" && selectedUserFacility
            ? `Reports > Users > ${selectedUserFacility.label}`
            : "Reports";

  return (
    <TooltipProvider delayDuration={200}>
    <div>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (v === "facility" || v === "user") return;
          setTab(v as any);
        }}
        className="mt-6"
      >
        <div className="flex flex-col gap-8 lg:gap-4 lg:flex-row lg:items-center lg:justify-between">
          <PageHeader
            icon={BarChart3}
            title={headerTitle}
            description="Usage, facility, and per-user reports across the site."
          />
          <div className="flex items-center gap-2 self-stretch lg:self-center">
            <TabsList className="h-auto p-2 gap-1 flex-1 lg:flex-none bg-muted/40 self-stretch lg:self-auto">
            <TabsTrigger value="overall" className="flex-1 lg:flex-none px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Overall
            </TabsTrigger>
            {!isFacilityUser && <Popover open={pickerOpen} onOpenChange={(o) => { if (o) setUserPickerOpen(false); setPickerOpen(o); }}>
              <PopoverAnchor asChild>
                <TabsTrigger
                  value="facility"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openFacilityPicker();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="flex-1 lg:flex-none px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground"
                >
                  <Building2 className="h-3.5 w-3.5 mr-1.5" /> By Facility
                </TabsTrigger>
              </PopoverAnchor>
              <PopoverContent
                align="center"
                className="w-80 p-3"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => {
                  const t = e.target as HTMLElement | null;
                  if (t && t.closest('[data-state][role="tab"]')) {
                    e.preventDefault();
                  }
                }}
              >
                <div className="mb-2 text-sm font-medium">Select a facility</div>
                <FacilityCombobox
                  value={selectedFacility?.value ?? ""}
                  onChange={(v) => {
                    const f = facilities.find((x) => x.value === v);
                    if (!f) return;
                    setSelectedFacility({ value: f.value, label: f.label });
                    setFacilityKey((k) => k + 1);
                    setPickerOpen(false);
                    setTab("facility");
                  }}
                  options={facilities.map((f) => ({ value: f.value, label: f.label }))}
                  placeholder={facilitiesQuery.isLoading || facilities.length === 0 ? "Loading…" : "Select a facility"}
                />
              </PopoverContent>
            </Popover>}
            {isFacilityUser ? (
              <TabsTrigger
                value="user"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedUserFacility({ value: myFacilityValue ?? "__all__", label: myFacilityValue ?? "My Facility" });
                  setUserKey((k) => k + 1);
                  setActiveUser(null);
                  setTab("user");
                }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                className="flex-1 lg:flex-none px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground"
              >
                <UsersIcon className="h-3.5 w-3.5 mr-1.5" /> Users
              </TabsTrigger>
            ) : (
              <Popover open={userPickerOpen} onOpenChange={(o) => { if (o) setPickerOpen(false); setUserPickerOpen(o); }}>
                <PopoverAnchor asChild>
                  <TabsTrigger
                    value="user"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openUserPicker();
                    }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    className="flex-1 lg:flex-none px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground"
                  >
                    <UsersIcon className="h-3.5 w-3.5 mr-1.5" /> Users
                  </TabsTrigger>
                </PopoverAnchor>
                <PopoverContent
                  align="center"
                  className="w-80 p-3"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  onPointerDownOutside={(e) => {
                    const t = e.target as HTMLElement | null;
                    if (t && t.closest('[data-state][role="tab"]')) e.preventDefault();
                  }}
                >
                  <div className="mb-2 text-sm font-medium">Select a facility</div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserFacility({ value: "__all__", label: "All Facilities" });
                      setUserKey((k) => k + 1);
                      setUserPickerOpen(false);
                      setActiveUser(null);
                      setTab("user");
                    }}
                    className="mb-2 w-full rounded-md border border-input bg-background px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-medium">All Facilities</span>
                    <span className="ml-2 text-xs text-muted-foreground">Every registered user</span>
                  </button>
                  <FacilityCombobox
                    value={selectedUserFacility?.value && selectedUserFacility.value !== "__all__" ? selectedUserFacility.value : ""}
                    onChange={(v) => {
                      const f = facilities.find((x) => x.value === v);
                      if (!f) return;
                      setSelectedUserFacility({ value: f.value, label: f.label });
                      setUserKey((k) => k + 1);
                      setUserPickerOpen(false);
                      setActiveUser(null);
                      setTab("user");
                    }}
                    options={facilities.map((f) => ({ value: f.value, label: f.label }))}
                    placeholder={facilitiesQuery.isLoading || facilities.length === 0 ? "Loading…" : "Select a facility"}
                  />
                </PopoverContent>
              </Popover>
            )}
          </TabsList>
          </div>
        </div>

        <TabsContent value="overall" className="mt-8">
          {isFacilityUser && myFacilityValue ? (
            <UsageReportView scope={{ kind: "facility", facilityValue: myFacilityValue, facilityLabel: myFacilityValue }} />
          ) : (
            <>
              <UsageReportView scope={{ kind: "overall" }} />
              <FacilityComparisonSection />
            </>
          )}
        </TabsContent>
        <TabsContent value="facility" className="mt-8">
          {selectedFacility ? (
            <FacilityReportTab
              key={`${facilityKey}-${selectedFacility.value}`}
              preselected={selectedFacility}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="user" className="mt-8">
          {selectedUserFacility ? (
            <UsersReportTab
              key={`${userKey}-${selectedUserFacility.value}`}
              preselected={isFacilityUser && myFacilityValue
                ? { value: myFacilityValue, label: myFacilityValue }
                : selectedUserFacility}
              activeUser={activeUser}
              setActiveUser={setActiveUser}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
    </TooltipProvider>
  );
}
