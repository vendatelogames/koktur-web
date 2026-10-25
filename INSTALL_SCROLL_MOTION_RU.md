# Установка KOKTUR Web Scroll Motion 1.2.4

## Для твоего отдельного репозитория `vendatelogames/koktur-web`

1. Скачай архив `KOKTUR_WEB_SCROLL_MOTION_v1.2.4_PATCH.zip` и распакуй его.
2. Скопируй папку `web` из архива в корень локального репозитория `koktur-web`, соглашаясь на объединение/замену файлов. **Не копируй вложенный внешний каталог целиком** — итоговые пути должны быть `web/index.html`, `web/styles.css`, `web/app.js`, `web/sw.js`.
3. Не меняй Windows или Android репозитории: это только фронтенд сайта. Сохрани `.github/workflows/koktur-website-publish-only.yml` в репозитории `koktur-web`.
4. В GitHub Desktop сделай commit `Add KOKTUR scroll motion v1.2.4` и Push origin.
5. Открой GitHub → Actions → `KOKTUR WEBSITE - PUBLISH ONLY`. Дождись зелёной галочки.
6. Открой `https://vendatelogames.github.io/koktur-web/` и обнови страницу. Service worker cache был обновлён; если браузер показывает старую версию, сделай hard refresh (`Ctrl+F5`) или закрой и снова открой вкладку.

## Что появится

- Заголовки, карточки возможностей, секции приватности и Telegram-ссылки плавно появляются при прокрутке.
- 3D-эмблема в первом экране плавно меняет позицию/наклон/размер и hue-оттенок в зависимости от прокрутки. На устройствах с меньшей производительностью эффекты смягчаются.
- При `prefers-reduced-motion` или включённой настройке уменьшения движения анимации отключаются или сводятся к минимуму.
- Интерфейс чата не меняется.

## Проверки

Запускаются в папке репозитория:

```bash
node --check web/app.js
node --check web/site-config.js
node --test web/tests/site.test.cjs
node --test web/site.test.cjs
```

Все 10 тестов `web/tests/site.test.cjs` и 5 тестов `web/site.test.cjs` должны пройти.
