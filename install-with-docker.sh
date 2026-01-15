#!/bin/bash

# Скрипт установки Docker и запуска контейнера k1p1kcode/funpaybors
# Требует прав суперпользователя (sudo)

set -e  # Прерывать выполнение при ошибках

# Функция для вывода цветных сообщений
print_message() {
    echo -e "\e[1;32m$1\e[0m"
}

# Функция для вывода предупреждений
print_warning() {
    echo -e "\e[1;33m$1\e[0m"
}

# Функция для вывода ошибок
print_error() {
    echo -e "\e[1;31mОшибка: $1\e[0m"
}

# Функция для очистки экрана
clear_screen() {
    clear
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

# Красивое отображение запроса GOLDEN_KEY
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                  ТРЕБУЕТСЯ GOLDEN_KEY                 ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║ Для работы контейнера необходим GOLDEN_KEY            ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

while true; do
    read -p "Введите ваш GOLDEN_KEY: " GOLDEN_KEY

    # Проверка, что ключ не пустой
    if [ -z "$GOLDEN_KEY" ]; then
        print_error "GOLDEN_KEY не может быть пустым!"
        continue
    fi

    # Проверка минимальной длины (например, 10 символов)
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

# Проверка, что порт является числом
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
    print_error "Некорректный номер порта! Используется порт по умолчанию 58899"
    PORT=58899
fi

# Проверка, что порт свободен
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
    # Создаем директорию, если она не существует
    mkdir -p "$VOLUME_PATH"
    chmod 755 "$VOLUME_PATH"
    VOLUME_MOUNT="-v $VOLUME_PATH:/app/data"
    print_message "✓ Директория создана: $VOLUME_PATH"
else
    VOLUME_MOUNT=""
fi

# 5. Остановка и удаление старого контейнера (если есть)
print_message "5. Подготовка к запуску..."

if docker ps -a --format '{{.Names}}' | grep -q '^funpaybors-container$'; then
    print_message "Найден старый контейнер, останавливаем и удаляем..."
    docker stop funpaybors-container > /dev/null 2>&1 || true
    docker rm funpaybors-container > /dev/null 2>&1 || true
    print_message "✓ Старый контейнер удален"
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

# Формируем команду запуска
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

# Запускаем контейнер
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
print_message "  Просмотр логов в реальном времени:"
print_message "    docker logs -f funpaybors-container"
echo ""
print_message "  Остановка контейнера:"
print_message "    docker stop funpaybors-container"
echo ""
print_message "  Запуск контейнера:"
print_message "    docker start funpaybors-container"
echo ""
print_message "  Перезапуск контейнера:"
print_message "    docker restart funpaybors-container"
echo ""
print_message "  Удаление контейнера:"
print_message "    docker rm -f funpaybors-container"
echo ""
print_message "  Войти в контейнер (bash):"
print_message "    docker exec -it funpaybors-container bash"
echo ""
print_message "  Просмотр статистики:"
print_message "    docker stats funpaybors-container"
echo ""
print_message "==================================================="
print_message "ДЛЯ ПРОВЕРКИ РАБОТЫ:"
print_message "==================================================="
echo ""
print_message "1. Проверьте, что контейнер запущен:"
print_message "   docker ps | grep funpaybors"
echo ""
print_message "2. Проверьте логи на наличие ошибок:"
print_message "   docker logs funpaybors-container"
echo ""
print_message "3. Если приложение использует веб-интерфейс:"
print_message "   Откройте браузер и перейдите по адресу:"
print_message "   http://ваш_сервер:$PORT"
echo ""
print_message "==================================================="
print_message "ВАЖНО:"
print_message "==================================================="
echo ""
print_warning "• Убедитесь, что порт $PORT открыт в фаерволе"
print_warning "• GOLDEN_KEY должен оставаться конфиденциальным"
print_warning "• Регулярно проверяйте обновления образа:"
print_warning "  docker pull k1p1kcode/funpaybors"
echo ""
print_message "==================================================="

# Создаем файл с информацией о запуске
INFO_FILE="/tmp/funpaybors_install_info.txt"
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
  Остановка: docker stop funpaybors-container
  Запуск: docker start funpaybors-container
  Перезапуск: docker restart funpaybors-container
  Удаление: docker rm -f funpaybors-container
EOF

print_message "Информация об установке сохранена в: $INFO_FILE"
print_message "==================================================="