# ANYMINUS · App

Мобильное караоке-приложение. Каталог, поиск, статус, дорожки и текст загружаются через API. Адрес задаётся при сборке через `VITE_DEMO_API_ORIGIN` (GitHub Actions: `DEMO_API_ORIGIN`); предусмотрен публичный адрес по умолчанию. Нет переключения на тестовый каталог.

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
