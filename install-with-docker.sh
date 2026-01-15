#!/bin/bash

# Скрипт установки Docker и запуска контейнера k1p1kcode/funpaybors
# Требует прав суперпользователя (sudo)

set -e  # Прерывать выполнение при ошибках

# Функция для вывода цветных сообщений
print_message() {
    echo -e "\e[1;32m$1\e[0m"
}

print_warning() {
    echo -e "\e[1;33m$1\e[0m"
}

print_error() {
    echo -e "\e[1;31mОшибка: $1\e[0m"
}

print_info() {
    echo -e "\e[1;36m$1\e[0m"
}

# Функция для очистки экрана
clear_screen() {
    clear
}

# Функция проверки существования контейнера
check_existing_container() {
    if docker ps -a --format '{{.Names}}' | grep -q '^funpaybors-container$'; then
        return 0  # Контейнер существует
    else
        return 1  # Контейнер не существует
    fi
}

# Функция отображения информации о контейнере
show_container_info() {
    echo ""
    print_info "╔═══════════════════════════════════════════════════════╗"
    print_info "║            НАЙДЕН СУЩЕСТВУЮЩИЙ КОНТЕЙНЕР              ║"
    print_info "╠═══════════════════════════════════════════════════════╣"

    CONTAINER_INFO=$(docker ps -a --filter "name=funpaybors-container" --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}" | tail -n +2)

    if [ -n "$CONTAINER_INFO" ]; then
        print_info "║ Контейнер: funpaybors-container                     ║"

        # Проверяем статус
        if docker ps --format '{{.Names}}' | grep -q '^funpaybors-container$'; then
            STATUS="✅ ЗАПУЩЕН"
        else
            STATUS="⏸️ ОСТАНОВЛЕН"
        fi
        print_info "║ Статус: $STATUS"

        # Получаем порты
        PORTS=$(docker inspect --format='{{range $p, $conf := .NetworkSettings.Ports}}{{if $conf}}{{(index $conf 0).HostPort}}->{{$p}}{{end}}{{end}}' funpaybors-container 2>/dev/null || echo "не настроены")
        print_info "║ Порт(ы): $PORTS"

        # Получаем образ
        IMAGE=$(docker inspect --format='{{.Config.Image}}' funpaybors-container 2>/dev/null || echo "неизвестен")
        print_info "║ Образ: $IMAGE"

        # Получаем время создания
        CREATED=$(docker inspect --format='{{.Created}}' funpaybors-container 2>/dev/null | cut -d'.' -f1 | sed 's/T/ /' || echo "неизвестно")
        print_info "║ Создан: $CREATED"
    fi

    print_info "╚═══════════════════════════════════════════════════════╝"
    echo ""
}

# Функция меню управления существующим контейнером
show_container_menu() {
    while true; do
        echo ""
        print_message "ВЫБЕРИТЕ ДЕЙСТВИЕ:"
        echo ""
        print_info "  1) Переустановить контейнер (удалить старый и установить новый)"
        print_info "  2) Удалить существующий контейнер"
        print_info "  3) Показать логи контейнера"
        print_info "  4) Перезапустить контейнер"
        print_info "  5) Остановить контейнер"
        print_info "  6) Запустить остановленный контейнер"
        print_info "  7) Продолжить установку без изменений (выйти из меню)"
        print_info "  8) Выйти из скрипта"
        echo ""

        read -p "Ваш выбор (1-8): " choice

        case $choice in
            1)
                echo ""
                print_warning "Вы выбрали переустановку контейнера."
                print_warning "Это удалит текущий контейнер и создаст новый."
                read -p "Вы уверены? (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    # Остановка и удаление контейнера
                    print_message "Останавливаем контейнер..."
                    docker stop funpaybors-container > /dev/null 2>&1 || true
                    print_message "Удаляем контейнер..."
                    docker rm funpaybors-container > /dev/null 2>&1 || true
                    print_message "✅ Контейнер удален. Продолжаем установку нового..."
                    return 1  # Вернем 1 чтобы продолжить установку
                else
                    print_message "Отмена переустановки."
                fi
                ;;
            2)
                echo ""
                print_warning "Вы выбрали удаление контейнера."
                read -p "Вы уверены? (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    print_message "Останавливаем контейнер..."
                    docker stop funpaybors-container > /dev/null 2>&1 || true
                    print_message "Удаляем контейнер..."
                    docker rm funpaybors-container > /dev/null 2>&1 || true
                    print_message "✅ Контейнер удален."
                    print_message "Скрипт завершает работу."
                    exit 0
                else
                    print_message "Отмена удаления."
                fi
                ;;
            3)
                echo ""
                print_message "Последние 50 строк логов контейнера:"
                echo "═══════════════════════════════════════════════════════"
                docker logs --tail 50 funpaybors-container 2>/dev/null || print_error "Не удалось получить логи"
                echo "═══════════════════════════════════════════════════════"
                ;;
            4)
                echo ""
                print_message "Перезапускаем контейнер..."
                docker restart funpaybors-container > /dev/null 2>&1
                if [ $? -eq 0 ]; then
                    print_message "✅ Контейнер перезапущен."
                else
                    print_error "Не удалось перезапустить контейнер."
                fi
                ;;
            5)
                echo ""
                print_message "Останавливаем контейнер..."
                docker stop funpaybors-container > /dev/null 2>&1
                if [ $? -eq 0 ]; then
                    print_message "✅ Контейнер остановлен."
                else
                    print_error "Не удалось остановить контейнер."
                fi
                ;;
            6)
                echo ""
                print_message "Запускаем контейнер..."
                docker start funpaybors-container > /dev/null 2>&1
                if [ $? -eq 0 ]; then
                    print_message "✅ Контейнер запущен."
                else
                    print_error "Не удалось запустить контейнер."
                fi
                ;;
            7)
                echo ""
                print_message "Продолжаем установку без изменений..."
                return 0  # Вернем 0 чтобы пропустить установку
                ;;
            8)
                echo ""
                print_message "Выход из скрипта."
                exit 0
                ;;
            *)
                print_error "Неверный выбор. Пожалуйста, выберите 1-8."
                ;;
        esac
    done
}

# Очистка экрана в начале
clear_screen

# Проверка прав суперпользователя
if [ "$EUID" -ne 0 ]; then
    print_error "Запустите скрипт с правами суперпользователя: sudo $0"
    exit 1
fi

print_message "==================================================="
print_message "  Установка Docker и запуск funpaybors контейнера  "
print_message "==================================================="
echo ""

# Проверка существования контейнера
if check_existing_container; then
    show_container_info
    show_container_menu
    MENU_RESULT=$?

    # Если выбрана переустановка (возврат 1) или продолжение без изменений (возврат 0)
    if [ $MENU_RESULT -eq 0 ]; then
        print_message "Пропускаем установку, так как контейнер уже существует."
        print_message "Для управления контейнером используйте команды Docker."
        print_message "Скрипт завершает работу."
        exit 0
    fi
    # Если MENU_RESULT = 1, продолжаем установку
fi

# 1. Проверка и установка Docker
print_message "1. Проверяем установлен ли Docker..."

if command -v docker &> /dev/null; then
    print_message "✓ Docker уже установлен"
else
    print_message "Устанавливаем Docker..."

    # Обновление пакетов
    apt-get update -y

    # Установка зависимостей
    apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        software-properties-common

    # Добавление GPG ключа Docker
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    # Добавление репозитория Docker
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Установка Docker
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

    # Проверка установки
    if command -v docker &> /dev/null; then
        print_message "✓ Docker успешно установлен"
    else
        print_error "Не удалось установить Docker"
        exit 1
    fi
fi

# 2. Запуск Docker службы
print_message "2. Запускаем службу Docker..."
systemctl enable docker --now > /dev/null 2>&1
print_message "✓ Служба Docker запущена"

# 3. Загрузка образа из Docker Hub
print_message "3. Загружаем образ k1p1kcode/funpaybors..."
docker pull k1p1kcode/funpaybors > /dev/null 2>&1

if [ $? -eq 0 ]; then
    print_message "✓ Образ успешно загружен"
else
    print_error "Не удалось загрузить образ"
    exit 1
fi

# 4. Запрос параметров для запуска
print_message "4. Настройка параметров запуска..."
echo ""

# Запрос GOLDEN_KEY
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                  ТРЕБУЕТСЯ GOLDEN_KEY                 ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║ Для работы контейнера необходим GOLDEN_KEY            ║"
echo "║ Получите ключ у администратора или поставщика         ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

while true; do
    read -p "Введите ваш GOLDEN_KEY: " GOLDEN_KEY

    if [ -z "$GOLDEN_KEY" ]; then
        print_error "GOLDEN_KEY не может быть пустым!"
        continue
    fi

    if [ ${#GOLDEN_KEY} -lt 10 ]; then
        print_warning "Ключ слишком короткий. Убедитесь, что он правильный."
        read -p "Вы уверены, что хотите использовать этот ключ? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            break
        fi
    else
        break
    fi
done

echo ""
read -p "Введите порт для проброса (по умолчанию 58899): " PORT
PORT=${PORT:-58899}

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
    print_error "Некорректный номер порта! Используется порт по умолчанию 58899"
    PORT=58899
fi

if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    print_warning "Порт $PORT уже используется! Это может вызвать конфликт."
    read -p "Продолжить? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_message "Установка отменена"
        exit 0
    fi
fi

echo ""
print_message "Дополнительные настройки (можно пропустить, нажав Enter):"
read -p "Путь для сохранения данных (например, /opt/funpaybors/data): " VOLUME_PATH

if [ -n "$VOLUME_PATH" ]; then
    mkdir -p "$VOLUME_PATH"
    chmod 755 "$VOLUME_PATH"
    VOLUME_MOUNT="-v $VOLUME_PATH:/app/data"
    print_message "✓ Директория создана: $VOLUME_PATH"
else
    VOLUME_MOUNT=""
fi

# 5. Окончательная проверка перед запуском
print_message "5. Подготовка к запуску..."

# Еще раз проверяем, не появился ли контейнер в процессе установки
if check_existing_container; then
    print_error "Контейнер funpaybors-container уже существует! Возможно, он был создан в другом процессе."
    print_message "Пожалуйста, удалите его или используйте другое имя."
    exit 1
fi

# 6. Запуск контейнера
print_message "6. Запускаем контейнер с параметрами:"
echo ""
print_message "   • GOLDEN_KEY: [скрыто]"
print_message "   • Порт: $PORT"
if [ -n "$VOLUME_PATH" ]; then
    print_message "   • Данные сохраняются в: $VOLUME_PATH"
fi
echo ""

CMD="docker run -d \
  --name funpaybors-container \
  --restart unless-stopped \
  -p $PORT:58899 \
  $VOLUME_MOUNT \
  k1p1kcode/funpaybors \
  -gk $GOLDEN_KEY --server"

print_message "Команда запуска:"
echo "  $CMD"
echo ""

print_message "Запускаем контейнер..."
if eval $CMD; then
    print_message "✓ Контейнер успешно запущен!"
else
    print_error "Не удалось запустить контейнер"
    exit 1
fi

# 7. Проверка статуса
print_message "7. Проверяем статус контейнера..."
sleep 5

echo ""
print_message "Статус контейнера:"
docker ps --filter "name=funpaybors-container" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
print_message "Последние логи контейнера:"
docker logs --tail 5 funpaybors-container

# 8. Итоговая информация
clear_screen
print_message "==================================================="
print_message "      УСТАНОВКА УСПЕШНО ЗАВЕРШЕНА!                 "
print_message "==================================================="
echo ""
print_message "Контейнер 'funpaybors-container' запущен с параметрами:"
echo ""
print_message "  • Имя контейнера: funpaybors-container"
print_message "  • Образ: k1p1kcode/funpaybors"
print_message "  • GOLDEN_KEY: [установлен]"
print_message "  • Порт хоста: $PORT"
print_message "  • Порт контейнера: 58899"
if [ -n "$VOLUME_PATH" ]; then
    print_message "  • Данные сохраняются в: $VOLUME_PATH"
fi
print_message "  • Автоперезапуск: включен"
echo ""
print_message "==================================================="
print_message "КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ:"
print_message "==================================================="
echo ""
print_message "  Для повторного запуска этого скрипта с меню управления:"
print_message "    sudo ./$(basename "$0")"
echo ""
print_message "  Просмотр логов в реальном времени:"
print_message "    docker logs -f funpaybors-container"
echo ""
print_message "  Быстрая переустановка (одной командой):"
print_message "    docker rm -f funpaybors-container && sudo ./$(basename "$0")"
echo ""
print_message "  Остановка контейнера:"
print_message "    docker stop funpaybors-container"
echo ""
print_message "==================================================="

# Создаем файл с информацией о запуске
INFO_FILE="/tmp/funpaybors_install_$(date +%Y%m%d_%H%M%S).txt"
cat > "$INFO_FILE" << EOF
Информация об установке funpaybors
Дата установки: $(date)
----------------------------------------
Контейнер: funpaybors-container
Образ: k1p1kcode/funpaybors
Порт: $PORT
GOLDEN_KEY: [установлен]
Путь к данным: ${VOLUME_PATH:-не настроен}
Команда запуска: $CMD
----------------------------------------
Команды управления:
  Просмотр логов: docker logs -f funpaybors-container
  Переустановка: docker rm -f funpaybors-container && sudo ./$(basename "$0")
  Остановка: docker stop funpaybors-container
  Запуск: docker start funpaybors-container
EOF

print_message "Информация об установке сохранена в: $INFO_FILE"
print_message "==================================================="