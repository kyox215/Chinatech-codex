"use client";
import { useLanguage } from "@/components/language-provider";
import { useBackendState } from "@/components/backend-snapshot";
import { useBackendMode } from "@/components/backend-snapshot";

import { NavigationLink as Link } from "@/components/navigation-link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, Boxes, ChevronUp, ClipboardList, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Search, Settings, UserRound, UsersRound, Wrench, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { AppNavigationContext } from "@/components/page-title";
import { useStaff } from "@/components/staff/use-staff";
import { AccessPanel } from "@/components/staff/access-panel";
import { selectPreviewMember } from "@/lib/staff-client";
import { isActiveMember, staffRoles, type Permission } from "@/lib/staff";
import { SelectControl } from "@/components/select-control";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "./logout-button";
import { ContentProgress } from "@/components/operation-feedback";

type NavItemConfig = { label: string; icon: LucideIcon; href?: string };
const primaryNav: NavItemConfig[] = [
  { label: "工作台", icon: LayoutDashboard, href: "/app/dashboard" },
  { label: "维修工单", icon: ClipboardList, href: "/app/repairs" },
  { label: "整机商品", icon: Boxes, href: "/app/retail" },
  { label: "客户管理", icon: UsersRound, href: "/app/customers" }, { label: "客户设备", icon: Wrench, href: "/app/customer-devices" },
];
function subscribeMobile(callback: () => void) {
  const media = window.matchMedia("(max-width: 767px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const mobileSnapshot = () => window.matchMedia("(max-width: 767px)").matches;
function NavItem({ item, active, onNavigate }: { item: NavItemConfig; active: boolean; onNavigate: () => void }) {
  const { t } = useLanguage();
  return item.href ? <Link icon={<item.icon size={19} />} className={`app-nav__item${active ? " app-nav__item--active" : ""}`} href={item.href} title={t(item.label)} aria-label={t(item.label)} aria-current={active ? "page" : undefined} onNavigationComplete={onNavigate}><span>{t(item.label)}</span></Link>
    : <span className="app-nav__item app-nav__item--disabled" aria-disabled="true" title={t("{v0} · 规划中", { v0: t(item.label) })}><item.icon size={19} /><span>{t(item.label)}</span></span>;
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const backendMode = useBackendMode();
  const { snapshot } = useBackendState();
  const staff = useStaff();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = pathname + "?" + searchParams.toString();
  const [identityError,setIdentityError] = useState("");
  const [menus, setMenus] = useState({ route, drawer: false, account: false });
  if (menus.route !== route) setMenus({ route, drawer: false, account: false });
  const menuOpen = menus.route === route && menus.drawer;
  const accountOpen = menus.route === route && menus.account;
  const setMenuOpen = useCallback((next: boolean | ((open: boolean) => boolean)) => {
    setMenus(current => {
      if (current.route !== route) return current;
      const drawer = typeof next === "function" ? next(current.drawer) : next;
      return drawer === current.drawer ? current : { ...current, drawer };
    });
  }, [route]);
  const setAccountOpen = useCallback((open: boolean) => {
    setMenus(current => current.route !== route || current.account === open ? current : { ...current, account: open });
  }, [route]);
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
  const sidebar = useRef<HTMLElement>(null);
  const account = useRef<HTMLDetailsElement>(null);
  const notifications = useRef<HTMLDialogElement>(null);
  const isActive = (href?: string) => href === "/app/dashboard" ? pathname === href : Boolean(href && pathname.startsWith(href));
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (account.current?.open && event.target instanceof Node && !account.current.contains(event.target)) setAccountOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [setAccountOpen]);
  useLayoutEffect(() => {
    if (!isMobile || !menuOpen || !accountOpen) return;
    const panel = sidebar.current, menu = account.current;
    const brand = panel?.querySelector<HTMLElement>(".app-sidebar__brand-row");
    const summary = menu?.querySelector<HTMLElement>(":scope > summary");
    const actions = menu?.querySelector<HTMLElement>(":scope > .sidebar-account__actions");
    if (!panel || !menu || !brand || !summary || !actions) return;
    let active = true, previous: number | undefined;
    const measure = () => {
      if (!active || !panel.isConnected || !menu.open) return;
      const brandBounds = brand.getBoundingClientRect(), summaryBounds = summary.getBoundingClientRect(), actionsBounds = actions.getBoundingClientRect();
      const gap = Math.max(0, summaryBounds.top - actionsBounds.bottom);
      const available = Math.max(0, actionsBounds.bottom - brandBounds.bottom - gap);
      if (available === previous) return;
      previous = available;
      menu.style.setProperty("--sidebar-account-available-height", `${available}px`);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    for (const element of [panel, brand, summary]) observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => { active = false; observer?.disconnect(); window.removeEventListener("resize", measure); menu.style.removeProperty("--sidebar-account-available-height"); };
  }, [isMobile, menuOpen, accountOpen]);
  useEffect(() => {
    if (!isMobile || !menuOpen || !sidebar.current) return;
    const panel = sidebar.current;
    const previousFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : document.querySelector<HTMLElement>(".page-menu-button");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')).filter((element) => element.getClientRects().length > 0);
    panel.querySelector<HTMLButtonElement>(".app-sidebar__close")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (account.current?.open) { event.stopPropagation(); setAccountOpen(false); account.current.querySelector("summary")?.focus(); return; }
        setMenuOpen(false);
      }
      if (event.key !== "Tab") return;
      const elements = focusable(); const first = elements[0]; const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    panel.addEventListener("keydown", onKeyDown);
    return () => { panel.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [isMobile, menuOpen, setAccountOpen, setMenuOpen]);
  const routePermission = (href: string): Permission | null => href.startsWith("/app/retail") ? "retail.view" : href.startsWith("/app/repairs") || href.startsWith("/app/procurement") ? "repairs.view" : href.startsWith("/app/customer") ? "customers.view" : null;
  const allowed = Boolean(staff.ready && !staff.error && staff.member && (pathname.startsWith("/app/settings") ? pathname==="/app/settings/store" || staff.can("settings.edit") || staff.can("financial.read") || staff.can("staff.manage") : pathname === "/app/dashboard" ? staff.can("retail.view") && staff.can("repairs.view") && staff.can("customers.view") : !routePermission(pathname) || staff.can(routePermission(pathname)!)));
  const closeMenu = useCallback(() => { setMenus(current => current.route !== route || !current.drawer && !current.account ? current : { ...current, drawer: false, account: false }); }, [route]);
  return <AppNavigationContext.Provider value={{ isMobile, expanded: isMobile ? menuOpen : !collapsed, toggle: () => isMobile ? setMenuOpen((value) => !value) : setCollapsed((value) => !value) }}>
    <div className={`app-shell${collapsed ? " app-shell--collapsed" : ""}`}>
      <aside id="app-sidebar" ref={sidebar} className={`app-sidebar${menuOpen ? " app-sidebar--open" : ""}`} inert={isMobile && !menuOpen} role={isMobile && menuOpen ? "dialog" : undefined} aria-modal={isMobile && menuOpen ? true : undefined} aria-label={t("主菜单")}>
        <div className="app-sidebar__brand-row"><Brand compact /><button className="app-sidebar__collapse" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? t("展开侧栏") : t("收起侧栏")} aria-expanded={!collapsed} aria-controls="app-sidebar" title={collapsed ? t("展开侧栏") : t("收起侧栏")}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button><button className="app-sidebar__close" type="button" onClick={closeMenu} aria-label={t("关闭菜单")}><X size={20} /></button></div>
        <Link className="app-search" href="/app/repairs" aria-label={t("搜索工单")} title={t("搜索工单")} onNavigationComplete={closeMenu} icon={<Search size={19} />}><span>{t("搜索工单")}</span></Link>
        <nav className="app-nav" aria-label={t("内部系统主导航")}><small className="app-nav__label">{t("主菜单")}</small>{primaryNav.filter(item => !item.href || !routePermission(item.href) || staff.can(routePermission(item.href)!)).map((item) => <NavItem item={item} active={isActive(item.href)} key={item.label} onNavigate={closeMenu} />)}</nav>
        <details ref={account} className="sidebar-account" open={accountOpen} onToggle={event => setAccountOpen(event.currentTarget.open)} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); setAccountOpen(false); account.current?.querySelector("summary")?.focus(); } }}>
          <summary aria-label={backendMode&&snapshot ? t("{v0} · 账号菜单",{v0:snapshot.settings.shopName}) : t("账号菜单")} title={backendMode&&snapshot ? snapshot.settings.shopName : t("账号菜单")} onClick={event => { event.preventDefault(); setAccountOpen(!accountOpen); }}><span className="profile-menu__avatar"><UserRound size={20} /></span><span className="sidebar-account__text"><strong>{staff.member?.name || t("预览身份待核对")}</strong><small>{backendMode?(snapshot?.settings.shopName??t("门店账号")):t("本地预览")} · {staff.member ? t(staffRoles[staff.member.role]) : t("访问不可用")}</small></span><ChevronUp size={16} /></summary>
          <div className="sidebar-account__actions">
            <LanguageSwitcher />
            {backendMode ? <Link className="sidebar-account__action" href="/account/stores" onNavigationComplete={closeMenu} icon={<UsersRound size={18} />}><span>{t("我的门店")}</span></Link> : null}
            {backendMode ? <Link className="sidebar-account__action" href="/app/settings/store" onNavigationComplete={closeMenu} icon={<Settings size={18} />}><span>{t("门店容量与邀请")}</span></Link> : null}
            {backendMode ? <Link className="sidebar-account__action" href="/account/settings" onNavigationComplete={closeMenu} icon={<UserRound size={18} />}><span>{t("账号设置")}</span></Link> : null}
            <Link className="sidebar-account__action" href="/app/catalog" onNavigationComplete={closeMenu} icon={<Boxes size={18} />}><span>{t("设备目录")}</span></Link>
            {staff.can("settings.edit") || staff.can("financial.read") || staff.can("staff.manage") ? <Link className="sidebar-account__action" href="/app/settings" onNavigationComplete={closeMenu} icon={<Settings size={18} />}><span>{t("门店设置")}</span></Link> : null}
            {!backendMode ? <label className="field sidebar-preview-identity"><span>{t("预览身份")}</span><SelectControl aria-label={t("预览身份")} value={staff.data.currentId} onChange={event => {try {selectPreviewMember(event.target.value);setIdentityError("");closeMenu();}catch(reason){setIdentityError(reason instanceof Error ? reason.message : "切换失败");}}}>{staff.data.members.filter(isActiveMember).map(member=><option key={member.id} value={member.id}>{member.name} · {t(staffRoles[member.role])}</option>)}</SelectControl>{identityError ? <small role="alert">{t(identityError)}</small> : null}</label> : null}
            <button type="button" className="sidebar-account__action" onClick={() => { setAccountOpen(false); account.current?.querySelector("summary")?.focus(); notifications.current?.showModal(); }} aria-label={t("通知")} title={t("通知")}><Bell size={18} /><span>{t("通知")}</span></button>
            <LogoutButton supabaseMode={backendMode} />
          </div>
        </details>
      </aside>
      {isMobile && menuOpen ? <button className="sidebar-scrim" type="button" aria-label={t("关闭菜单遮罩")} onClick={closeMenu} tabIndex={-1} /> : null}
      <div className="app-main" inert={isMobile && menuOpen}><ContentProgress /><div className="app-content" key={staff.member?.id + ":" + staff.member?.revision}>{allowed ? children : <AccessPanel />}</div></div>
      <dialog ref={notifications} className="repair-parts-dialog" aria-label={t("通知")}><header><h2>{t("通知")}</h2><button className="icon-button" type="button" onClick={() => notifications.current?.close()} aria-label={t("关闭通知")}><X size={20} /></button></header><div className="module-empty"><Bell size={28} /><strong>{t("暂无通知")}</strong></div></dialog>
    </div>
  </AppNavigationContext.Provider>;
}
