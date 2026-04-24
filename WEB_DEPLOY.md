# FridgeMate Web Deployment

Запуск без Expo Go (по обычной ссылке в браузере телефона).

## 1) Локально проверить web

```bash
npm run web
```

## 2) Собрать production web

```bash
npm run web:build
```

Готовая статика будет в папке `dist`.

## 3) Быстрый локальный preview production-сборки

```bash
npm run web:preview
```

Открыть в браузере адрес `http://<ваш-ip>:4173`.

## 4) Выложить в интернет (рекомендуется)

### Vercel (самый быстрый вариант)

1. Создать проект на [Vercel](https://vercel.com/).
2. Загрузить репозиторий.
3. Build Command: `npm run web:build`
4. Output Directory: `dist`
5. Добавить env переменные:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_GROQ_API_KEY`
   - `EXPO_PUBLIC_GROQ_MODEL`
6. Deploy и открыть ссылку на телефоне.

### Netlify

1. Создать сайт на [Netlify](https://www.netlify.com/).
2. Build Command: `npm run web:build`
3. Publish directory: `dist`
4. Добавить те же env-переменные.

## Важно

- После изменения env-переменных нужен новый redeploy.
- `expo-notifications` на web ограничен: основной сценарий — мобильные/нативные сборки.
