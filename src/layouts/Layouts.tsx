import {CommandPalette,ThemeControl,categories} from "../components/V3";
import {rpc,errorText} from "../services/data";
import {datetime} from "../config/types";
import { AirAlertStatus, CityStrip } from "../components/CityLive";
import {
  APP_VERSION,
  CityStatus,
  GlobalAnnouncement,
  InstallPrompt,
  NotificationBell,
  PageOutlet,
} from "../components/V2";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, Navigate } from "react-router-dom";
import { Bell, Menu, Search, X, User, ArrowUpRight } from "lucide-react";
import { useAuth } from "../hooks/Auth";
import { useSettings } from "../hooks/Settings";
import { useData } from "../hooks/useData";
import { list } from "../services/data";
import { configured, requireClient } from "../services/client";
import { State, Modal, Popover, useToast, Button } from "../components/UI";
const navigation = [
  ["/", "Головна"],
  ["/services", "Послуги"],
  ["/now", "Черкаси зараз"],
  ["/appeals", "Звернення"],
  ["/news", "Новини"],
  ["/documents", "Документи"],
  ["/events", "Події"],
  ["/help", "Допомога"],
];
export function PublicLayout() {
  const { settings } = useSettings(),
    auth = useAuth(),
    [open, setOpen] = useState(false), [scrolled,setScrolled]=useState(false), [reading,setReading]=useState(false);
  const toast=useToast();
  useEffect(()=>{const fn=()=>setScrolled(window.scrollY>24);fn();window.addEventListener("scroll",fn,{passive:true});return()=>window.removeEventListener("scroll",fn)},[]);
  const loc = useLocation();
  const notifications = useData(
    () =>
      auth.session
        ? rpc("sync_announcement_notifications").then(()=>list("notifications", { eq: { read_at: null }, size: 5 }))
        : Promise.resolve({ rows: [], count: 0 }),
    [auth.session?.user.id, loc.pathname],
  );
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    if (!auth.session) return;
    const t = setInterval(notifications.reload, 30000);
    return () => clearInterval(t);
  }, [auth.session?.user.id]);
  const logo =
    configured && settings.logo_path
      ? requireClient()
          .storage.from("site-assets")
          .getPublicUrl(settings.logo_path).data.publicUrl
      : import.meta.env.BASE_URL + "logo.svg";
  return (
    <>
      <a className="skip-link" href="#main">
        До вмісту
      </a>
      <GlobalAnnouncement />
      <header className={"site-header"+(scrolled?" scrolled":"")}>
        <div className="brand-status">
          <Link to="/" className="brand">
            <img src={logo} alt="Логотип порталу" />
            <span>{settings.name}</span>
          </Link>
          <CityStatus />
        </div>
        <AirAlertStatus />
        <nav
          className={open ? "main-nav open" : "main-nav"}
          aria-label="Головне меню"
        >
          {navigation.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              {label}
            </NavLink>
          ))}
          <div className="mobile-menu-tools"><CommandPalette shortcut={false}/><ThemeControl/></div>
        </nav>
        <div className="header-actions">
          <CommandPalette/><ThemeControl/>
          <Popover
            className="notification-menu"
            label={`Сповіщення: ${notifications.data?.count || 0} непрочитаних`}
            trigger={
              <NotificationBell count={notifications.data?.count || 0} />
            }
          >
            <strong>Сповіщення</strong>
            {notifications.data?.rows.map((n) => (
              <Link
                key={n.id}
                to={
                  n.link?.startsWith("/") && !n.link.startsWith("//")
                    ? n.link
                    : "/account/notifications"
                }
              >
                <small>{categories[n.category||n.type]||"Системні"} · {datetime(n.created_at)}</small><span>{n.title}</span>
              </Link>
            ))}
            {notifications.error&&<p className="field-error">{notifications.error}</p>}
            {!!notifications.data?.count&&<Button className="secondary small" busy={reading} onClick={async()=>{setReading(true);try{await rpc("set_notification_read");notifications.reload();toast("Позначено прочитаними")}catch(e){toast(errorText(e),"error")}finally{setReading(false)}}}>Позначити всі прочитаними</Button>}
            {!notifications.error&&!notifications.data?.count && (
              <p>Немає непрочитаних повідомлень</p>
            )}
            <Link to="/account/notifications">Усі сповіщення →</Link>
          </Popover>
          {auth.session ? (
            <Popover
              label="Меню профілю"
              trigger={
                <>
                  <User size={18} />
                  <span>{auth.profile?.first_name || "Кабінет"}</span>
                </>
              }
            >
              <Link to="/account">Мій кабінет</Link>
              {auth.roles.length > 0 && (
                <Link to="/staff">Панель працівника</Link>
              )}
              {auth.roles.some((r) =>
                ["super_admin", "admin", "department_admin", "editor"].includes(
                  r,
                ),
              ) && <Link to="/admin">Адмінпанель</Link>}
              <button onClick={() => void auth.logout()}>Вийти</button>
            </Popover>
          ) : (
            <Link className="button small" to="/auth/login">
              Увійти <ArrowUpRight size={16} />
            </Link>
          )}
          <button
            className="burger"
            aria-label={open ? "Закрити меню" : "Відкрити меню"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {!configured && (
        <div className="demo-strip">
          Демонстраційний перегляд · Supabase не підключено · Зміни та
          авторизація недоступні
        </div>
      )}
      {settings.maintenance_notice && (
        <div className="alert">{settings.maintenance_notice}</div>
      )}
      <CityStrip />
      <main id="main">
        <Outlet />
      </main>
      <InstallPrompt />
      <footer>
        <div className="footer-grid">
          <div>
            <Link to="/" className="brand">
              <img src={logo} alt="" />
              <span>{settings.name}</span>
            </Link>
            <p>{settings.description}</p>
          </div>
          <div>
            <h4>Міські сервіси</h4>
            <Link to="/services">Каталог послуг</Link>
            <Link to="/now">Черкаси зараз</Link>
            <Link to="/appeals">Звернення</Link>
          </div>
          <div>
            <h4>Інформація</h4>
            <Link to="/documents">Документи</Link>
            <Link to="/help">Допомога</Link>
            <Link to="/privacy">Конфіденційність</Link>
            <Link to="/terms">Умови використання</Link>
            <Link to="/accessibility">Доступність</Link>
          </div>
          <div>
            <h4>Зв’язок</h4>
            {settings.contact_email ? (
              <a href={"mailto:" + settings.contact_email}>
                {settings.contact_email}
              </a>
            ) : (
              <span>Контакти не налаштовані</span>
            )}
            {(settings.social_links || [])
              .filter((s: any) => /^https?:\/\//.test(s.url))
              .map((s: any) => (
                <a
                  key={s.url}
                  href={s.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {s.label}
                </a>
              ))}
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {settings.name}
          </span>
          <span>{settings.footer_text}</span>
          <small className="app-version" title="Версія порталу">
            v{APP_VERSION}
          </small>
        </div>
      </footer>
    </>
  );
}
export function Guard({ roles }: { roles?: string[] }) {
  const a = useAuth(),
    loc = useLocation();
  if (a.loading)
    return (
      <State loading error="">
        {null}
      </State>
    );
  if (!a.session)
    return (
      <Navigate
        to={"/auth/login?next=" + encodeURIComponent(loc.pathname + loc.search)}
        replace
      />
    );
  if (!a.profile || a.profile.blocked)
    return (
      <div className="container">
        <h1>Доступ до акаунта обмежено</h1>
        <p>Зверніться до адміністратора або повторіть вхід.</p>
      </div>
    );
  if (roles && !a.roles.some((r) => roles.includes(r)))
    return (
      <div className="container">
        <h1>Доступ обмежено</h1>
        <p>Для цього розділу потрібна службова роль.</p>
      </div>
    );
  return <Outlet />;
}
export const accountLinks = [
  ["", "Огляд"],
  ["applications", "Мої заяви"],
  ["drafts", "Чернетки"],
  ["appeals", "Мої звернення"],
  ["documents", "Документи"],
  ["saved", "Збережені послуги"],
  ["notifications", "Сповіщення"],
  ["activity", "Центр активності"],
  ["addresses", "Мої адреси"],
  ["profile", "Профіль"],
  ["security", "Безпека"],
];
export function Workspace({
  kind,
  links,
}: {
  kind: string;
  links: string[][];
}) {
  const [drawer, setDrawer] = useState(false);
  const workspaceNav = (
    <nav aria-label="Меню кабінету">
      {links.map(([to, label]) => (
        <NavLink
          key={to}
          to={"/" + kind + (to ? "/" + to : "")}
          end={to === ""}
          onClick={() => setDrawer(false)}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
  return (
    <div className="workspace">
      <button
        className="workspace-toggle button secondary"
        onClick={() => setDrawer(true)}
      >
        <Menu size={18} />
        Меню кабінету
      </button>
      {drawer && (
        <Modal title="Меню кабінету" onClose={() => setDrawer(false)}>
          <div className="workspace-drawer">{workspaceNav}</div>
        </Modal>
      )}
      <aside>
        <p className="eyebrow">
          {kind === "account"
            ? "Особистий кабінет"
            : kind === "staff"
              ? "Робочий простір"
              : "Управління порталом"}
        </p>
        <nav aria-label="Меню кабінету">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={"/" + kind + (to ? "/" + to : "")}
              end={to === ""}
            >
              {label}
            </NavLink>
          ))}
          <div className="mobile-menu-tools"><CommandPalette shortcut={false}/><ThemeControl/></div>
        </nav>
      </aside>
      <div className="workspace-content">
        <Outlet />
      </div>
    </div>
  );
}
