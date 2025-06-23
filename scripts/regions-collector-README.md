# Сборщик ID регионов России

Парсер для автоматического сбора ID и названий регионов России с Яндекс Карт.

## Как это работает

1. **Формирование URL**: `https://yandex.ru/maps/{ID}/tver/?ll=35.917421%2C56.858745&z=12`
2. **Подстановка ID**: от 1 до 150 (или указанный диапазон)
3. **Анализ редиректов**: отслеживание финального URL после редиректа
4. **Извлечение названий**: получение реального названия региона из URL

## Логика определения статусов

### ✅ **SUCCESS** - регион найден
- Название региона в URL изменилось с `tver` на реальное
- Пример: `/maps/213/tver/` → `/maps/213/moscow/`

### ❌ **ERROR** - техническая ошибка  
- Сетевые ошибки, таймауты, недоступность сервера
- **Эти записи СОХРАНЯЮТСЯ** для последующего анализа

### ❓ **NOT_FOUND** - ID не существует
- Не удалось извлечь название региона
- **Эти записи НЕ СОХРАНЯЮТСЯ** в финальные файлы

## Команды запуска

```bash
# Сбор всех регионов (ID 1-150)
npm run collect-regions

# Сбор определенного диапазона
npm run collect-regions 1 50

# Прямой запуск через ts-node
npx ts-node scripts/regions-collector.ts 10 30
```

## Результирующие файлы

### 1. `results/regions-collection.json`
Полная информация о регионах (только SUCCESS и ERROR):
```json
{
  "totalProcessed": 150,
  "successCount": 85,
  "errorCount": 5,
  "notFoundCount": 60,
  "savedRegionsCount": 90,
  "regions": [
    {
      "id": 213,
      "name": "moscow", 
      "originalUrl": "https://yandex.ru/maps/213/tver/...",
      "finalUrl": "https://yandex.ru/maps/213/moscow/...",
      "status": "success"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. `results/regions-simple.json`
Упрощенный список (только SUCCESS):
```json
[
  {
    "id": 213,
    "name": "moscow",
    "url": "https://yandex.ru/maps/213/moscow/..."
  }
]
```

### 3. `results/regions.csv`
CSV файл для Excel (SUCCESS + ERROR):
```
ID,Название,Статус,Исходный URL,Финальный URL,Ошибка
213,"moscow","success","https://...","https://...",""
```

## Фильтрация данных

### Что сохраняется:
- ✅ **SUCCESS регионы** - полная информация
- ❌ **ERROR регионы** - для анализа проблем

### Что НЕ сохраняется:
- ❓ **NOT_FOUND записи** - исключаются из всех файлов

## Статистика

```
📊 Всего обработано: 150
✅ Успешно найдено: 85  
❌ Ошибки: 5
❓ Не найдено (не сохранено): 60
💾 Сохранено в JSON: 90 записей
```

## Настройки

В файле `scripts/regions-collector.ts`:

```typescript
// Базовые настройки
private baseUrl = 'https://yandex.ru/maps';
private urlParams = '/?ll=35.917421%2C56.858745&z=12';

// Таймауты
timeout: 15000  // 15 секунд на загрузку страницы
waitForTimeout(500)  // Пауза между запросами
```

## Примеры использования

```bash
# Быстрый тест на 20 регионах
npm run collect-regions 1 20

# Сбор популярных регионов
npm run collect-regions 200 250

# Полный сбор
npm run collect-regions
``` 