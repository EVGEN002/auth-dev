# @evgen002/auth-dev

Получает dev-токен и записывает его в `.env` проекта как `VITE_API_KEY`.
Если текущий токен (JWT) ещё живой, запрос не выполняется.

## Установка

Пакет лежит в GitHub Packages, поэтому в проекте нужен `.npmrc`:

```
@evgen002:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

`GITHUB_TOKEN` — personal access token (classic) со scope `read:packages`.

```sh
bun add -d @evgen002/auth-dev
# или
npm i -D @evgen002/auth-dev
```

## Использование

В `package.json` проекта:

```json
{
  "scripts": {
    "auth": "auth-dev"
  }
}
```

```sh
bun run auth
bun run auth -- --force   # обновить токен принудительно
```

## Переменные окружения

Читаются из окружения или из `.env` в текущей директории.

| Переменная       | Обязательна | Описание                                                 |
| ---------------- | ----------- | -------------------------------------------------------- |
| `DEV_ENDPOINT`   | да          | URL авторизации (`POST { login, password }` → `{ token }`) |
| `DEV_LOGIN`      | да          | Логин                                                    |
| `DEV_PASSWORD`   | да          | Пароль                                                   |
| `DEV_TOKEN_PATH` | нет         | Путь к токену в ответе через точку, по умолчанию `token` |
| `DEV_TOKEN_SKEW` | нет         | За сколько секунд до истечения обновлять, по умолчанию `300` |

## Публикация

Создайте релиз на GitHub — workflow `.github/workflows/publish.yml` опубликует пакет.
Вручную: `npm login --registry=https://npm.pkg.github.com`, затем `npm publish`.
