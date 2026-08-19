import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Um manifest de PWA só suporta um `start_url`, mas o WMS tem duas fachadas:
 * `/login` (desktop) e `/m/login` (coletor mobile). Esta raiz é o ponto de
 * bifurcação — decidimos pelo user-agent para que o app instalado abra na
 * fachada correta em cada dispositivo.
 */
export default async function HomePage() {
  const userAgent = (await headers()).get("user-agent") ?? "";
  const isMobile = /Android|iPhone|iPod|Windows Phone|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  redirect(isMobile ? "/m/login" : "/login");
}
