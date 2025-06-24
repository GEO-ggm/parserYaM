@echo off
echo ================================
echo Парсер компьютерных клубов
echo ================================
echo.

:: Проверяем наличие Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не найден!
    echo Пожалуйста, установите Node.js с официального сайта: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [INFO] Node.js найден
echo.

:: Проверяем наличие папки node_modules
if not exist "node_modules" (
    echo [INFO] Устанавливаем зависимости...
    call npm install
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Не удалось установить зависимости
        pause
        exit /b 1
    )
)

:: Устанавливаем браузеры Playwright
echo [INFO] Устанавливаем браузер Chromium...
call npx playwright install chromium
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось установить браузер Chromium
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Установка завершена!
echo [INFO] Запускаем парсер...
echo.

:: Запускаем парсер
call clubs-parser.exe

echo.
echo [INFO] Парсинг завершен. Результаты сохранены в папку 'results'
echo.
pause 