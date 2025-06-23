# Playwright + TypeScript проект

Это проект для E2E тестирования с использованием Playwright и TypeScript.

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Установка браузеров для Playwright
```bash
npx playwright install
```

### 3. Запуск тестов
```bash
# Запуск всех тестов
npm test

# Запуск тестов с UI (визуальный режим)
npm run test:ui

# Запуск тестов с браузером (headful режим)
npm run test:headed

# Запуск тестов в режиме отладки
npm run test:debug
```

## 📁 Структура проекта

```
├── tests/                  # Папка с тестами
│   ├── utils/              # Утилиты для тестов
│   │   └── helpers.ts      # Вспомогательные функции
│   └── example.spec.ts     # Пример тестов
├── playwright.config.ts    # Конфигурация Playwright
├── tsconfig.json          # Конфигурация TypeScript
├── package.json           # Зависимости проекта
└── README.md             # Документация
```

## 🛠 Доступные команды

- `npm test` - Запуск всех тестов
- `npm run test:headed` - Запуск тестов с открытым браузером
- `npm run test:debug` - Запуск тестов в режиме отладки
- `npm run test:ui` - Запуск тестов в UI режиме
- `npm run test:report` - Показать отчет о последнем запуске
- `npm run codegen` - Генерация кода тестов

## 📊 Отчеты и результаты

- Отчеты сохраняются в папке `playwright-report/`
- Скриншоты и видео в папке `test-results/`
- Для просмотра отчета: `npm run test:report`

## 🔧 Конфигурация

Основная конфигурация находится в файле `playwright.config.ts`. Здесь можно настроить:

- Браузеры для тестирования
- Параллельность выполнения
- Тайм-ауты
- Скриншоты и видео
- Репортеры

## 📝 Написание тестов

Пример простого теста:

```typescript
import { test, expect } from '@playwright/test';

test('мой первый тест', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});
```

## 🚀 Полезные команды Playwright

```bash
# Генерация тестов через запись действий
npx playwright codegen https://example.com

# Запуск конкретного теста
npx playwright test example.spec.ts

# Запуск тестов только в Chrome
npx playwright test --project=chromium

# Запуск тестов с дополнительными опциями
npx playwright test --headed --slowMo=1000
```

## 🔍 Отладка

1. **UI Mode**: `npm run test:ui` - интерактивный режим
2. **Debug Mode**: `npm run test:debug` - пошаговая отладка
3. **Trace Viewer**: Автоматически включен при падении тестов

## 📚 Полезные ссылки

- [Документация Playwright](https://playwright.dev/docs/intro)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Лучшие практики](https://playwright.dev/docs/best-practices) 