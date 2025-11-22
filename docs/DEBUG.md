# Debug Logging

## Environment Variables

### Connection Package (`@mcp-abap-adt/connection`)
```bash
DEBUG_TESTS=true npm test
```
Виводить: CSRF tokens, cookies, HTTP requests з connection пакета

### ADT-Clients Package (`@mcp-abap-adt/adt-clients`)
```bash
DEBUG_ADT=true npm test
# або
DEBUG_ADT_TESTS=true npm test
```
Виводить: логи тестів з adt-clients (builder operations, test steps)

### Комбінації

```bash
# Тільки connection логи
DEBUG_TESTS=true npm test

# Тільки adt-clients логи  
DEBUG_ADT=true npm test

# Обидва разом
DEBUG_TESTS=true DEBUG_ADT=true npm test
```

## Рекомендації

- **Дебаг тестів adt-clients**: `DEBUG_ADT=true npm test`
- **Дебаг connection проблем**: `DEBUG_TESTS=true npm test`
- **Повний вивід**: `DEBUG_TESTS=true DEBUG_ADT=true npm test`
