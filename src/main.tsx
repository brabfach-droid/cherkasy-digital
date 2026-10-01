import { lazy, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/Auth";
import { SettingsProvider, useSettings } from "./hooks/Settings";
import { State, ToastProvider } from "./components/UI";
import {
  PublicLayout,
  Guard,
  Workspace,
  accountLinks,
} from "./layouts/Layouts";
import "./styles/global.css";
const Public = lazy(() =>
    import("./pages/PublicPages").then((m) => ({ default: m.Home })),
  ),
  Catalog = lazy(() =>
    import("./pages/PublicPages").then((m) => ({ default: m.Catalog })),
  ),
  Detail = lazy(() =>
    import("./pages/PublicPages").then((m) => ({ default: m.Detail })),
  ),
  Now = lazy(() =>
    import("./pages/PublicPages").then((m) => ({ default: m.CityNow })),
  ),
  Help = lazy(() =>
    import("./pages/PublicPages").then((m) => ({ default: m.Help })),
  ),
  Search = lazy(() =>
    import("./pages/PublicPages").then((m) => ({ default: m.SearchPage })),
  ),
  Info = lazy(() =>
    import("./pages/PublicPages").then((m) => ({ default: m.Info })),
  ),
  NotFound = lazy(() =>
    import("./pages/PublicPages").then((m) => ({ default: m.NotFound })),
  ),
  Auth = lazy(() => import("./pages/AuthPages")),
  Account = lazy(() => import("./pages/Account"));
const Apply = lazy(() =>
    import("./pages/Applications").then((m) => ({ default: m.Apply })),
  ),
  AppDetail = lazy(() =>
    import("./pages/Applications").then((m) => ({
      default: m.ApplicationDetail,
    })),
  ),
  Appeals = lazy(() =>
    import("./pages/Applications").then((m) => ({ default: m.Appeals })),
  ),
  AppealDetail = lazy(() =>
    import("./pages/Applications").then((m) => ({ default: m.AppealDetail })),
  );
const Dashboard = lazy(() =>
    import("./pages/Admin").then((m) => ({ default: m.Dashboard })),
  ),
  Crud = lazy(() => import("./pages/Admin").then((m) => ({ default: m.Crud }))),
  Builder = lazy(() =>
    import("./pages/Admin").then((m) => ({ default: m.FormBuilder })),
  ),
  Users = lazy(() =>
    import("./pages/Admin").then((m) => ({ default: m.UserManagement })),
  ),
  Settings = lazy(() =>
    import("./pages/Admin").then((m) => ({ default: m.Settings })),
  ),
  Audit = lazy(() =>
    import("./pages/Admin").then((m) => ({ default: m.Audit })),
  ),
  Files = lazy(() =>
    import("./pages/Admin").then((m) => ({ default: m.Files })),
  ),
  StaffList = lazy(() =>
    import("./pages/Admin").then((m) => ({ default: m.StaffList })),
  );
function Meta() {
  const l = useLocation(),
    { settings } = useSettings();
  useEffect(() => {
    document.title =
      (l.pathname === "/"
        ? ""
        : (
            {
              "/services": "Послуги",
              "/news": "Новини",
              "/documents": "Документи",
              "/events": "Події",
              "/now": "Черкаси зараз",
              "/account": "Кабінет",
              "/admin": "Адмінпанель",
            } as Record<string, string>
          )[l.pathname] || "Міський портал") +
      (l.pathname === "/" ? "" : " · ") +
      settings.name;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", settings.description || "");
    let link = document.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = new URL(
      import.meta.env.BASE_URL.replace(/\/$/, "") + l.pathname,
      import.meta.env.VITE_SITE_URL || location.origin,
    ).href;
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute("content", document.title);
  }, [l.pathname, settings.name, settings.description]);
  return null;
}
function App() {
  const a = useAuth(),
    isAdmin = a.roles.some((r) => ["super_admin", "admin"].includes(r)),
    dept = a.roles.includes("department_admin"),
    editor = a.roles.includes("editor");
  const adminLinks = [
    ["", "Огляд"],
    ...(isAdmin || dept
      ? [
          ["services", "Послуги"],
          ["forms", "Форми"],
          ["applications", "Заяви"],
          ["appeals", "Звернення"],
        ]
      : []),
    ...(isAdmin
      ? [
          ["service-categories", "Категорії послуг"],
          ["appeal-categories", "Категорії звернень"],
          ["announcements", "Оголошення"],
          ["city", "Черкаси зараз"],
          ["users", "Користувачі / Staff / Ролі"],
          ["departments", "Департаменти"],
          ["faqs", "FAQ"],
          ["settings", "Налаштування"],
          ["audit", "Журнал аудиту"],
          ["deletions", "Видалення акаунтів"],
        ]
      : []),
    ...(isAdmin || editor
      ? [
          ["news", "Новини"],
          ["documents", "Документи"],
          ["events", "Події"],
          ["files", "Файли"],
        ]
      : []),
    ...(isAdmin
      ? [
          ["news-categories", "Категорії новин"],
          ["document-categories", "Категорії документів"],
        ]
      : []),
  ];
  const staffLinks = [
    ["", "Огляд"],
    ...(a.roles.some((r) =>
      [
        "super_admin",
        "admin",
        "department_admin",
        "operator",
        "viewer",
      ].includes(r),
    )
      ? [["applications", "Заяви"]]
      : []),
    ...(a.roles.some((r) =>
      [
        "super_admin",
        "admin",
        "department_admin",
        "appeals_operator",
        "viewer",
      ].includes(r),
    )
      ? [["appeals", "Звернення"]]
      : []),
    ...(isAdmin ? [["city", "Черкаси зараз"]] : []),
  ];
  return (
    <>
      <Meta />
      <Suspense
        fallback={
          <State loading error="">
            {null}
          </State>
        }
      >
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Public />} />
            {["services", "news", "documents", "events"].map((t) => (
              <Route key={t} path={t}>
                <Route index element={<Catalog />} />
                <Route path=":slug" element={<Detail />} />
              </Route>
            ))}
            <Route path="now" element={<Now />} />
            <Route path="search" element={<Search />} />
            <Route path="help" element={<Help />} />
            <Route path="appeals" element={<Appeals />} />
            {["privacy", "terms", "accessibility"].map((t) => (
              <Route key={t} path={t} element={<Info />} />
            ))}
            <Route path="auth/:mode" element={<Auth />} />
            <Route element={<Guard />}>
              <Route path="services/:slug/apply" element={<Apply />} />
              <Route
                path="account"
                element={<Workspace kind="account" links={accountLinks} />}
              >
                <Route index element={<Account />} />
                <Route path=":section" element={<Account />} />
                <Route path="applications/:id" element={<AppDetail />} />
                <Route path="appeals/:id" element={<AppealDetail />} />
              </Route>
            </Route>
            <Route
              element={
                <Guard
                  roles={[
                    "super_admin",
                    "admin",
                    "department_admin",
                    "operator",
                    "editor",
                    "appeals_operator",
                    "viewer",
                  ]}
                />
              }
            >
              <Route
                path="staff"
                element={<Workspace kind="staff" links={staffLinks} />}
              >
                <Route index element={<Dashboard />} />
                <Route path=":kind" element={<StaffList />} />
                <Route path="applications/:id" element={<AppDetail />} />
                <Route path="appeals/:id" element={<AppealDetail />} />
                <Route path="city" element={<CrudCity />} />
              </Route>
            </Route>
            <Route
              element={
                <Guard
                  roles={["super_admin", "admin", "department_admin", "editor"]}
                />
              }
            >
              <Route
                path="admin"
                element={<Workspace kind="admin" links={adminLinks} />}
              >
                <Route index element={<Dashboard />} />
                <Route path="forms" element={<Builder />} />
                <Route path="users" element={<Users />} />
                <Route path="settings" element={<Settings />} />
                <Route path="audit" element={<Audit />} />
                <Route path="files" element={<Files />} />
                <Route path="applications" element={<ListApplications />} />
                <Route path="appeals" element={<ListAppeals />} />
                <Route path="applications/:id" element={<AppDetail />} />
                <Route path="appeals/:id" element={<AppealDetail />} />
                <Route path=":resource" element={<Crud />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
function CrudCity() {
  return <Crud resourceName="city" />;
}
function ListApplications() {
  return <StaffList kindName="applications" />;
}
function ListAppeals() {
  return <StaffList kindName="appeals" />;
}
const redirect = sessionStorage.getItem("spa_redirect");
if (redirect) {
  sessionStorage.removeItem("spa_redirect");
  history.replaceState(
    null,
    "",
    import.meta.env.BASE_URL.replace(/\/$/, "") + redirect + location.hash,
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </AuthProvider>
    </ToastProvider>
  </BrowserRouter>,
);
