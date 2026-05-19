import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";

export const Route = createFileRoute("/admin/custom-home-pages")({
  beforeLoad: requireAdminBeforeLoad,
  component: () => <Outlet />,
});
