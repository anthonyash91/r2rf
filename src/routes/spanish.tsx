import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/spanish")({
  component: SpanishRedirect,
});

function SpanishRedirect() {
  const { setLang } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    setLang("es");
    navigate({ to: "/", replace: true });
  }, [setLang, navigate]);

  return null;
}
