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
