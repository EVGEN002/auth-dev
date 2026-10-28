#!/usr/bin/env node
/*
  Dev-авторизация: получает токен и записывает его в .env
  (по умолчанию как VITE_API_KEY, имена задаются через DEV_TOKEN_KEY).
  Запуск: bun run auth (под Node .env подхватывается через process.loadEnvFile).

  Если текущий токен ещё живой, запрос не выполняется.
  Форсировать обновление: bun run auth -- --force

  Нужны переменные окружения:
    DEV_ENDPOINT — URL авторизации (POST { login, password } → { token })
    DEV_LOGIN, DEV_PASSWORD — учётные данные

  Необязательные:
    DEV_TOKEN_PATH — путь к токену в ответе, через точку (по умолчанию "token")
    DEV_TOKEN_SKEW — за сколько секунд до истечения обновлять (по умолчанию 300)
    DEV_TOKEN_KEY — в какие переменные .env писать токен, через запятую
      (по умолчанию VITE_API_KEY), например VITE_API_KEY,BUN_PUBLIC_API_KEY
    DEV_TWO_FACTOR_ENDPOINT, DEV_TWO_FACTOR_CODE — если заданы обе, запрос
      уходит на DEV_TWO_FACTOR_ENDPOINT?two_factor_code=<код> вместо DEV_ENDPOINT
*/
const fs = require("node:fs");
const path = require("node:path");

const ENV_PATH = path.join(process.cwd(), ".env");
const FORCE = process.argv.includes("--force");

// Bun грузит .env сам, Node — нет. Уже заданные переменные не перезаписываются.
if (typeof process.loadEnvFile === "function" && fs.existsSync(ENV_PATH)) {
  process.loadEnvFile(ENV_PATH);
}

const ENV_KEYS = (process.env.DEV_TOKEN_KEY || "VITE_API_KEY")
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean);

// Цвета только в терминале и без NO_COLOR, чтобы не мусорить в логах CI.
const USE_COLOR =
  process.stdout.isTTY && process.stderr.isTTY && !("NO_COLOR" in process.env);

const paint = (code) => (text) =>
  USE_COLOR ? `\x1b[${code}m${text}\x1b[0m` : String(text);

const c = {
  bold: paint("1"),
  dim: paint("2"),
  red: paint("31"),
  green: paint("32"),
  yellow: paint("33"),
  cyan: paint("36"),
};

const PREFIX = c.cyan("[auth]");

const log = (message) => console.log(`${PREFIX} ${message}`);
const info = (message) => log(`${c.dim("•")} ${message}`);
const success = (message) => log(`${c.green("✔")} ${message}`);

const fail = (message) => {
  console.error(`${PREFIX} ${c.red("✖")} ${message}`);
  process.exit(1);
};

const paintStatus = (status) =>
  status >= 500 ? c.red : status >= 400 ? c.yellow : c.green;

// Кусок ответа сервера при ошибке: обычно там объяснение причины.
const formatBody = (text) => {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const short = trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed;
  return `\n${c.dim(short)}`;
};

const readEnv = () =>
  fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";

const writeEnv = (key, value) => {
  const content = readEnv();
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  // Замена функцией: иначе $& и $1 в токене будут раскрыты как группы.
  const next = pattern.test(content)
    ? content.replace(pattern, () => line)
    : `${content}${content && !content.endsWith("\n") ? "\n" : ""}${line}\n`;

  fs.writeFileSync(ENV_PATH, next);
};

const getEnvValue = (key) => {
  const match = readEnv().match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : "";
};

/*
  Возвращает срок жизни токена в секундах, или null если это не JWT
  либо в payload нет exp. null означает "проверить не смогли" —
  в этом случае токен запрашивается заново.
*/
const getSecondsLeft = (token) => {
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const { exp } = JSON.parse(json);
    if (typeof exp !== "number") return null;
    return exp - Math.floor(Date.now() / 1000);
  } catch {
    return null;
  }
};

const isStillValid = () => {
  const tokens = ENV_KEYS.map(getEnvValue);
  const [token] = tokens;
  // Если добавили новое имя в DEV_TOKEN_KEY, его тоже нужно заполнить.
  if (!token || tokens.some((value) => value !== token)) return false;

  const secondsLeft = getSecondsLeft(token);
  if (secondsLeft === null) return false;

  const skew = Number(process.env.DEV_TOKEN_SKEW) || 300;
  if (secondsLeft <= skew) return false;

  success(
    `токен действителен ещё ${c.bold(`${Math.floor(secondsLeft / 60)} мин`)}, пропускаю ${c.dim("(--force — обновить)")}`,
  );
  return true;
};

const pickToken = (data) => {
  const keys = (process.env.DEV_TOKEN_PATH || "token").split(".");
  const value = keys.reduce(
    (acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined),
    data,
  );
  return typeof value === "string" ? value : "";
};

const getAuthUrl = () => {
  const { DEV_ENDPOINT, DEV_TWO_FACTOR_ENDPOINT, DEV_TWO_FACTOR_CODE } =
    process.env;

  if (!DEV_TWO_FACTOR_ENDPOINT !== !DEV_TWO_FACTOR_CODE) {
    fail("Задайте DEV_TWO_FACTOR_ENDPOINT и DEV_TWO_FACTOR_CODE вместе");
  }

  if (!DEV_TWO_FACTOR_ENDPOINT) return DEV_ENDPOINT;

  let url;
  try {
    url = new URL(DEV_TWO_FACTOR_ENDPOINT);
  } catch {
    fail(`Некорректный DEV_TWO_FACTOR_ENDPOINT: ${DEV_TWO_FACTOR_ENDPOINT}`);
  }
  url.searchParams.set("two_factor_code", DEV_TWO_FACTOR_CODE);
  return url.toString();
};

const main = async () => {
  const { DEV_LOGIN, DEV_PASSWORD } = process.env;
  const authUrl = getAuthUrl();

  if (!authUrl || !DEV_LOGIN || !DEV_PASSWORD) {
    fail("Задайте DEV_ENDPOINT, DEV_LOGIN и DEV_PASSWORD в .env");
  }

  const badKey = ENV_KEYS.find((key) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key));
  if (!ENV_KEYS.length || badKey !== undefined) {
    fail(`Некорректное имя переменной в DEV_TOKEN_KEY: "${badKey ?? ""}"`);
  }

  if (!FORCE && isStillValid()) return;

  log(`${c.bold("POST")} ${authUrl}`);
  info(`логин: ${DEV_LOGIN}${process.env.DEV_TWO_FACTOR_CODE ? ", с кодом 2FA" : ""}`);

  const startedAt = Date.now();
  const elapsed = () => c.dim(`${Date.now() - startedAt} мс`);

  let response;
  try {
    response = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: DEV_LOGIN, password: DEV_PASSWORD }),
    });
  } catch (error) {
    // fetch прячет причину в cause, а при нескольких адресах — в cause.errors.
    const cause = error.cause?.errors?.[0] ?? error.cause ?? error;
    fail(`Не удалось подключиться: ${cause.code || cause.message} · ${elapsed()}`);
  }

  const status = paintStatus(response.status)(
    `${response.status} ${response.statusText}`.trim(),
  );
  const text = await response.text().catch(() => "");

  if (!response.ok) {
    fail(`${status} · ${elapsed()}${formatBody(text)}`);
  }

  success(`${status} · ${elapsed()}`);

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fail(`Ответ сервера — не JSON${formatBody(text)}`);
  }

  const token = pickToken(data);
  if (!token) {
    fail(`В ответе нет поля ${process.env.DEV_TOKEN_PATH || "token"}`);
  }

  ENV_KEYS.forEach((key) => writeEnv(key, token));

  const keys = c.bold(ENV_KEYS.join(", "));
  const secondsLeft = getSecondsLeft(token);
  success(
    secondsLeft === null
      ? `${keys} записан в .env`
      : `${keys} записан в .env, истекает через ${c.bold(`${Math.floor(secondsLeft / 60)} мин`)}`,
  );
};

main();
