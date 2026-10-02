# @evgen002/auth-dev

Получает dev-токен и записывает его в `.env` проекта. Пока токен (JWT) действителен, повторный запрос не делается.

## Установка

Один раз на компьютере войдите в GitHub Packages. Пароль — [токен (classic)](https://github.com/settings/tokens/new) с правом `read:packages`:

```sh
npm login --registry=https://npm.pkg.github.com --auth-type=legacy
```

В корне проекта создайте `.npmrc`:

```
@evgen002:registry=https://npm.pkg.github.com
```

Установите пакет (имя только строчными):

```sh
bun add -d @evgen002/auth-dev
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

Имя в `DEV_TOKEN_KEY` должно начинаться с префикса вашего сборщика: Vite — `VITE_`, Bun — `BUN_PUBLIC_`, Create React App — `REACT_APP_`, Next.js — `NEXT_PUBLIC_`. В webpack (`dotenv-webpack`) подойдёт любое имя.

## Публикация новой версии

```sh
npm version minor        # или patch / major
git push --follow-tags
gh release create v1.1.0 --generate-notes
```

GitHub Actions опубликует пакет после создания релиза.
