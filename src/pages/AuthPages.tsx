import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Button, useToast } from "../components/UI";
import { errorText } from "../services/data";
import { requireClient, siteUrl, configured } from "../services/client";
import { useAuth } from "../hooks/Auth";
export default function AuthPage() {
  const { mode } = useParams(),
    [params] = useSearchParams(),
    navigate = useNavigate(),
    toast = useToast(),
    a = useAuth();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const titles: Record<string, string> = {
    login: "Раді бачити вас",
    register: "Створіть свій акаунт",
    "forgot-password": "Відновлення пароля",
    "reset-password": "Новий пароль",
    verify: "Підтвердження email",
  };
  const next = params.get("next") || "/account";
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  useEffect(() => {
    if (mode === "verify" && a.session && !a.loading) navigate("/account");
  }, [mode, a.session, a.loading]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const c = requireClient();
      if (mode === "login") {
        const { error } = await c.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate(safeNext);
      } else if (mode === "register") {
        const { data, error } = await c.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: name },
            emailRedirectTo: siteUrl() + "auth/verify",
          },
        });
        if (error) throw error;
        if (data.session) navigate("/account");
        else
          setMessage(
            "Відкрийте лист і натисніть посилання підтвердження email.",
          );
      } else if (mode === "forgot-password") {
        const { error } = await c.auth.resetPasswordForEmail(email, {
          redirectTo: siteUrl() + "auth/reset-password",
        });
        if (error) throw error;
        setMessage("Якщо акаунт існує, лист для відновлення надіслано.");
      } else if (mode === "reset-password") {
        if (!a.session)
          throw new Error("Спершу відкрийте посилання з листа відновлення.");
        const { error } = await c.auth.updateUser({ password });
        if (error) throw error;
        toast("Пароль змінено");
        navigate("/account/security");
      } else if (mode === "verify") {
        const { error } = await c.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: siteUrl() + "auth/verify" },
        });
        if (error) throw error;
        setMessage("Лист підтвердження надіслано.");
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-art">
        <p className="eyebrow">Ваше місто. Ваш простір.</p>
        <h2>
          Усе важливе
          <br />
          завжди поруч.
        </h2>
        <p>
          Подавайте заяви, отримуйте відповіді й користуйтеся міськими сервісами
          у власному кабінеті.
        </p>
        <div className="orb" />
      </div>
      <form className="auth-form" onSubmit={submit}>
        <p className="eyebrow">Черкаси Цифрові</p>
        <h1>{titles[mode || "login"] || "Авторизація"}</h1>
        {!configured && (
          <div className="alert">Для входу потрібно підключити Supabase.</div>
        )}
        {mode === "register" && (
          <label>
            Ім’я
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
              required
            />
          </label>
        )}
        {mode !== "reset-password" && (
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
        )}
        {["login", "register", "reset-password"].includes(mode || "") && (
          <label>
            Пароль
            <input
              type="password"
              minLength={mode === "login" ? 1 : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
            />
          </label>
        )}
        {mode === "register" && (
          <label className="check">
            <input type="checkbox" required />Я прочитав/ла{" "}
            <Link to="/privacy">політику конфіденційності</Link> та{" "}
            <Link to="/terms">умови</Link>.
          </label>
        )}
        {error && (
          <div role="alert" className="alert error">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="alert success">
            {message}
          </div>
        )}
        <Button busy={busy} disabled={!configured}>
          {mode === "login"
            ? "Увійти"
            : mode === "register"
              ? "Зареєструватися"
              : mode === "reset-password"
                ? "Змінити пароль"
                : "Надіслати лист"}
        </Button>
        <div className="auth-links">
          <Link to="/auth/login">Вхід</Link>
          <Link to="/auth/register">Реєстрація</Link>
          <Link to="/auth/forgot-password">Забули пароль?</Link>
        </div>
      </form>
    </div>
  );
}
