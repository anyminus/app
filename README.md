# ANYMINUS · App

Интерактивный мобильный прототип 0.1.0 и дизайн-система. Backend `anyminus/core` — только для чтения контрактов. Никаких реальных запросов к backend в текущей версии.

## Запуск

```sh
npm install
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run storybook
```

GitHub Pages: в Settings → Pages → Build and deployment выбрать GitHub Actions. Workflow собирает app и Storybook, проверяет тесты и публикует dist. Ссылки после успешного deploy: https://anyminus.github.io/app/ и https://anyminus.github.io/app/storybook/.

Демо: 8 вымышленных песен, оригинальные тестовые строки, две синтетические звуковые дорожки с общей временной шкалой, отдельные регуляторы. Синтетическая голосовая подсказка не является записью голоса артиста.

## Скрытый редактор
Пять быстрых нажатий на «Профиль» (в течение 4 секунд) показывают вкладку «Плейлисты». Режим действует в текущей вкладке браузера; его можно скрыть кнопкой с глазом. Плейлисты сохраняются в localStorage и меняют подборки на главной. Это не серверная авторизация.

## API integration
Use **Реальный каталог · API** on the home page. Configure an exact HTTPS origin (no path). Optional build variable `VITE_DEMO_API_ORIGIN`; GitHub Actions repository variable `DEMO_API_ORIGIN` populates it. No live origin assumed. See `docs/api-integration.md`. Never enter provider tokens or credentials. Demo and real catalogs remain separate.

Main Search tab now defaults to the real API. Without an approved origin, it displays connection settings. Explicit demo search remains available. A saved session origin or `VITE_DEMO_API_ORIGIN` connects automatically.
