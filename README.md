# ANYMINUS · App

Мобильное караоке-приложение. Каталог, поиск, статус, дорожки и текст загружаются через API. Адрес задаётся при сборке через `VITE_DEMO_API_ORIGIN` (GitHub Actions: `DEMO_API_ORIGIN`); предусмотрен публичный адрес по умолчанию. Нет переключения на тестовый каталог.

Вход через Telegram Mini App использует подписанные данные запуска и серверное подтверждение. Для перехода из обычного браузера задайте публичную ссылку Mini App через `VITE_TELEGRAM_MINI_APP_URL` (GitHub Actions: `TELEGRAM_MINI_APP_URL`). Токены не сохраняются в localStorage. Гостям доступно воспроизведение готовых песен; создание требует входа. Полноценный веб-вход и запрет гостевых запросов создания должны обеспечиваться API.

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
