# @evgen002/auth-dev

[![npm](https://img.shields.io/npm/v/@evgen002/auth-dev)](https://www.npmjs.com/package/@evgen002/auth-dev)

Получает dev-токен и записывает его в `.env` проекта. Пока токен (JWT) действителен, повторный запрос не делается.

## Установка

```sh
bun add -d @evgen002/auth-dev
# или
npm i -D @evgen002/auth-dev
```

## Использование

Добавьте в `.env` проекта:

```
DEV_ENDPOINT=https://example.com/auth
DEV_LOGIN=login
DEV_PASSWORD=password
```

Запустите:

```sh
bunx auth-dev           # получить токен
bunx auth-dev --force   # обновить, даже если старый ещё действует

# или через npm
npx auth-dev
npx auth-dev --force
```

## Переменные

| Переменная       | По умолчанию   | Описание                                        |
| ---------------- | -------------- | ----------------------------------------------- |
| `DEV_ENDPOINT`   | —              | URL авторизации: `POST { login, password }`     |
| `DEV_LOGIN`      | —              | Логин                                           |
| `DEV_PASSWORD`   | —              | Пароль                                          |
| `DEV_TOKEN_KEY`  | `VITE_API_KEY` | Куда записать токен, можно несколько через запятую |
| `DEV_TOKEN_PATH` | `token`        | Путь к токену в ответе, например `data.accessToken` |
| `DEV_TOKEN_SKEW` | `300`          | За сколько секунд до истечения обновлять токен  |
| `DEV_TWO_FACTOR_ENDPOINT` | —     | URL авторизации с 2FA, используется вместо `DEV_ENDPOINT` |
| `DEV_TWO_FACTOR_CODE` | —         | Код 2FA, передаётся как `?two_factor_code=<код>` |

Если заданы `DEV_TWO_FACTOR_ENDPOINT` и `DEV_TWO_FACTOR_CODE`, запрос уходит на `DEV_TWO_FACTOR_ENDPOINT?two_factor_code=<код>` с тем же телом `{ login, password }`, а `DEV_ENDPOINT` можно не задавать:

```
DEV_TWO_FACTOR_ENDPOINT=https://example.com/api/users/v1/main/auth
DEV_TWO_FACTOR_CODE=123456
```

Имя в `DEV_TOKEN_KEY` должно начинаться с префикса вашего сборщика: Vite — `VITE_`, Bun — `BUN_PUBLIC_`, Create React App — `REACT_APP_`, Next.js — `NEXT_PUBLIC_`. В webpack (`dotenv-webpack`) подойдёт любое имя.

## Публикация новой версии

```sh
npm version minor        # или patch / major
git push --follow-tags
gh release create "$(git describe --tags --abbrev=0)" --generate-notes
```

GitHub Actions опубликует пакет в npm после создания релиза. Токены не нужны — используется [Trusted Publishing](https://docs.npmjs.com/trusted-publishers): в настройках пакета на npmjs.com добавлен репозиторий `EVGEN002/auth-dev` и workflow `publish.yml`.
