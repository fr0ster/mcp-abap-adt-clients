# Lock/Unlock Object CLI Tools

Утиліти для блокування та розблокування SAP об'єктів з збереженням сесії.

## Навіщо це потрібно?

Ці CLI інструменти дозволяють:
1. Залочити об'єкт та зберегти session + lock handle на диск
2. Розлочити об'єкт пізніше, використовуючи збережену сесію
3. Працювати з об'єктами між різними запусками/процесами
4. Відновлювати роботу після збоїв

## Встановлення

```bash
npm install
npm run build
npm link  # Для глобального доступу до команд
```

## Використання

### 1. Залочити об'єкт

```bash
# Базове використання
adt-lock-object class ZCL_MY_CLASS

# З кастомним session ID
adt-lock-object class ZCL_MY_CLASS --session-id my_work_session

# Залочити програму
adt-lock-object program Z_MY_PROGRAM

# Залочити функцію
adt-lock-object fm MY_FUNCTION --function-group Z_MY_FUGR

# З кастомними директоріями
adt-lock-object class ZCL_TEST --sessions-dir /custom/sessions --locks-dir /custom/locks
```

**Що відбувається:**
- Створюється підключення до SAP
- Об'єкт блокується
- Session (cookies, CSRF token) зберігається в `.sessions/<session-id>.json`
- Lock handle зберігається в `.locks/active-locks.json`
- Виводиться команда для розблокування

### 2. Розлочити об'єкт

```bash
# Використати session ID з lock команди
adt-unlock-object class ZCL_MY_CLASS --session-id my_work_session

# Розлочити програму
adt-unlock-object program Z_MY_PROGRAM --session-id lock_program_Z_MY_PROGRAM_1234567890

# Розлочити функцію
adt-unlock-object fm MY_FUNCTION --function-group Z_MY_FUGR --session-id my_session

# З кастомними директоріями
adt-unlock-object class ZCL_TEST --session-id test --sessions-dir /custom/sessions
```

**Що відбувається:**
- Завантажується session з файлу
- Відновлюється session state в новому connection
- Знаходиться lock handle з registry
- Об'єкт розблоковується
- Lock видаляється з registry

## Підтримувані типи об'єктів

- `class` - ABAP Class
- `program` - ABAP Program
- `interface` - ABAP Interface
- `fm` - Function Module (потребує `--function-group`)
- `domain` - Domain
- `dataelement` - Data Element

## Опції

### Для обох команд:

| Опція | Опис | За замовчуванням |
|-------|------|------------------|
| `--session-id <id>` | Custom session ID | auto-generated (lock only) |
| `--sessions-dir <path>` | Директорія для sessions | `.sessions` |
| `--locks-dir <path>` | Директорія для locks | `.locks` |
| `--env <path>` | Шлях до .env файлу | `.env` |
| `--help, -h` | Показати допомогу | - |

### Тільки для function modules:

| Опція | Опис | Обов'язкова |
|-------|------|-------------|
| `--function-group <name>` | Ім'я function group | Так для FM |

## Вимоги до .env

```bash
SAP_URL=https://your-sap-system.com
SAP_USERNAME=your_username
SAP_PASSWORD=your_password
```

## Структура файлів

### Session File (`.sessions/<session-id>.json`)
```json
{
  "sessionId": "my_work_session",
  "timestamp": 1731586800000,
  "pid": 12345,
  "state": {
    "cookies": "sap-usercontext=sap-client%3d100; SAP_SESSIONID_xxx=...",
    "csrfToken": "xxxxx-xxxxx-xxxxx",
    "cookieStore": {
      "sap-usercontext": "sap-client=100",
      "SAP_SESSIONID_xxx": "..."
    }
  }
}
```

### Lock Registry (`.locks/active-locks.json`)
```json
{
  "locks": [
    {
      "sessionId": "my_work_session",
      "lockHandle": "LOCK_HANDLE_XYZ123",
      "objectType": "class",
      "objectName": "ZCL_MY_CLASS",
      "timestamp": 1731586800000,
      "pid": 12345,
      "testFile": "CLI"
    }
  ]
}
```

## Приклади сценаріїв

### Робота над класом протягом дня

```bash
# Ранок - залочити клас
adt-lock-object class ZCL_MY_WORK --session-id daily_work
# Session ID: daily_work

# ... працюєте, редагуєте через інші інструменти ...

# Вечір - розлочити клас
adt-unlock-object class ZCL_MY_WORK --session-id daily_work
```

### Передача lock між процесами

```bash
# Процес 1: Lock та збереження
adt-lock-object program Z_MIGRATION --session-id migration_2024
# Процес завершився/зкрешився

# Процес 2: Відновлення та unlock
adt-unlock-object program Z_MIGRATION --session-id migration_2024
```

### Робота з function module

```bash
# Lock
adt-lock-object fm MY_CUSTOM_FUNCTION --function-group Z_MY_FUGR --session-id fm_dev

# Unlock
adt-unlock-object fm MY_CUSTOM_FUNCTION --function-group Z_MY_FUGR --session-id fm_dev
```

## Управління sessions та locks

### Подивитись всі активні locks

```bash
adt-manage-locks list
```

### Подивитись всі sessions

```bash
adt-manage-sessions list
```

### Очистити stale locks

```bash
adt-manage-locks cleanup
```

### Подивитись інформацію про session

```bash
adt-manage-sessions info my_work_session
```

## .gitignore

Переконайтесь, що `.sessions/` та `.locks/` додані до `.gitignore`:

```gitignore
# Session and lock files
.sessions/
.locks/
```

## Troubleshooting

### Session не знайдено

```
Error: Session not found: my_session
```

**Рішення:** Перевірте, що session ID правильний та файл існує в `.sessions/`

### Lock не знайдено

```
Error: Lock not found for class ZCL_MY_CLASS
```

**Рішення:** 
- Перевірте `.locks/active-locks.json`
- Можливо lock вже видалено або ім'я об'єкта не збігається

### Різні session ID

```
Warning: Lock was created with different session ID
```

**Це попередження** - unlock все одно спрацює, але краще використовувати той самий session ID.

## Інтеграція з тестами

Ці утиліти використовують ту саму інфраструктуру, що й integration тести:
- `FileSessionStorage` для збереження sessions
- `LockStateManager` для tracking locks
-Ті самі lock/unlock функції з `core/`

## Дивись також

- [SESSION_STATE_MANAGEMENT.md](../SESSION_STATE_MANAGEMENT.md)
- [LOCK_STATE_MANAGEMENT.md](../LOCK_STATE_MANAGEMENT.md)
- [README_LOCK_RECOVERY.md](../src/__tests__/integration/README_LOCK_RECOVERY.md)
