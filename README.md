# ANYMINUS · App

Мобильное караоке-приложение. Каталог, поиск, статус, дорожки и текст загружаются через API. Адрес задаётся при сборке через `VITE_DEMO_API_ORIGIN` (GitHub Actions: `DEMO_API_ORIGIN`); предусмотрен публичный адрес по умолчанию. Нет переключения на тестовый каталог.

Вход через @anyminusbot: в обычном браузере используется Telegram OIDC Authorization Code + PKCE, внутри Mini App — подписанные данные запуска. Разрешённый callback — `https://anyminus.github.io/app/`. Токены доступа не сохраняются в localStorage или sessionStorage; временные state и PKCE verifier хранятся до возврата. Гостям доступны воспроизведение и, временно в DEV, явное создание через подписанную анонимную сессию. Для live-входа требуется настройка Telegram Login в BotFather и развёрнутый API.

Настройки, избранное, история и пользовательские подборки хранятся на устройстве; записи используют реальные ID песен. Серверная синхронизация этих списков пока не подключена.

```sh
npm install
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run storybook
```

https://anyminus.github.io/app/ · https://anyminus.github.io/app/storybook/

### Temporary DEV creation policy (0.4.1)
Telegram login remains optional while real-browser acceptance is pending. Explicit creation uses a server-issued signed demo session for guests or the verified Telegram session when available. No creation on navigation or login. The server flag and frontend gate must be enabled together only after owner approval.

### Artist popularity and artwork (0.4.2)
Provider-ranked artist songs use explicit 20-track continuation where available. Missing track cover metadata retries the stable public API image route; unavailable images retain a placeholder. Backend and frontend live acceptance must be verified separately.

### Анимация караоке (0.4.4)
Согласованный режим: активная строка 100%, остальные 75%; плавное масштабирование и прокрутка 480 мс, цвет и прозрачность 420 мс. Анимация не изменяет тайминги LRC, аудиочасы или ручную перемотку. Подробности: [архитектура](docs/architecture.md#karaoke-line-motion-044), [спецификация и критерии приёмки](docs/acceptance-0.4.4.md). Реальная проверка на устройстве выполняется отдельно от CI.

### Статус текста (0.4.5)
Готовые песни с подтверждённым TEXT отображают «Текст без таймкодов» тёплым оранжевым оттенком; LRC и неизвестный формат сохраняют прежнюю маркировку. Источник — сохранённый формат в API, а не эвристика.

### Караоке без текста (0.4.6)
При подтверждённом отсутствии доступного сохранённого текста готовая песня помечается бледно-красным «Караоке без текста». При появлении обычного или синхронизированного текста статус обновляется; ожидающие проверки песни не считаются отсутствующими.

### GitHub Pages: тестовые ветки
Рабочая версия всегда в корне /app/. [Публикация прототипов в отдельных каталогах](docs/pages-previews.md).

### Маска в видеокараоке (0.5.87)
Музыкальные ноты поверх глаз включены по умолчанию, отключаются галочкой перед записью. [Детекция, приватность и критерии проверки](docs/face-mask-prototype.md).
