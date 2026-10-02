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

const log = (message) => console.log(`[auth] ${message}`);

const fail = (message) => {
  console.error(`[auth] ${message}`);
  process.exit(1);
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

  log(`токен действителен ещё ${Math.floor(secondsLeft / 60)} мин, пропускаю`);
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

const main = async () => {
  const { DEV_ENDPOINT, DEV_LOGIN, DEV_PASSWORD } = process.env;

  if (!DEV_ENDPOINT || !DEV_LOGIN || !DEV_PASSWORD) {
    fail("Задайте DEV_ENDPOINT, DEV_LOGIN и DEV_PASSWORD в .env");
  }

  const badKey = ENV_KEYS.find((key) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key));
  if (!ENV_KEYS.length || badKey !== undefined) {
    fail(`Некорректное имя переменной в DEV_TOKEN_KEY: "${badKey ?? ""}"`);
  }

  if (!FORCE && isStillValid()) return;

  let response;
  try {
    response = await fetch(DEV_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: DEV_LOGIN, password: DEV_PASSWORD }),
    });
  } catch (error) {
    fail(`Не удалось подключиться к ${DEV_ENDPOINT}: ${error.message}`);
  }

  if (!response.ok) {
    fail(`Сервер ответил ${response.status} ${response.statusText}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    fail("Ответ сервера — не JSON");
  }

  const token = pickToken(data);
  if (!token) {
    fail(`В ответе нет поля ${process.env.DEV_TOKEN_PATH || "token"}`);
  }

  ENV_KEYS.forEach((key) => writeEnv(key, token));

  const keys = ENV_KEYS.join(", ");
  const secondsLeft = getSecondsLeft(token);
  log(
    secondsLeft === null
      ? `${keys} записан в .env`
      : `${keys} записан в .env, истекает через ${Math.floor(secondsLeft / 60)} мин`,
  );
};

main();
