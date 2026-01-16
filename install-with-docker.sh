#!/bin/bash

# Скрипт установки Docker и запуска контейнера k1p1kcode/funpaybors
# Поддерживает: Ubuntu, Debian, Fedora
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

print_success() {
    echo -e "\e[1;92m$1\e[0m"
}

# Функция для определения дистрибутива
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME="$ID"
        OS_VERSION="$VERSION_ID"
        OS_LIKE="$ID_LIKE"
    elif [ -f /etc/debian_version ]; then
        OS_NAME="debian"
        OS_VERSION=$(cat /etc/debian_version)
        OS_LIKE="debian"
    elif [ -f /etc/fedora-release ]; then
        OS_NAME="fedora"
        OS_VERSION=$(cat /etc/fedora-release | grep -o '[0-9]*')
        OS_LIKE="fedora"
    else
        OS_NAME=$(uname -s)
        OS_VERSION=$(uname -r)
    fi

    # Для производных дистрибутивов
    if [[ "$OS_LIKE" == *"ubuntu"* ]] || [[ "$OS_LIKE" == *"debian"* ]]; then
        OS_FAMILY="debian"
    elif [[ "$OS_LIKE" == *"fedora"* ]] || [[ "$OS_LIKE" == *"rhel"* ]] || [[ "$OS_NAME" == "centos"* ]]; then
        OS_FAMILY="fedora"
    elif [ "$OS_NAME" == "ubuntu" ] || [ "$OS_NAME" == "debian" ]; then
        OS_FAMILY="debian"
    elif [ "$OS_NAME" == "fedora" ] || [ "$OS_NAME" == "rhel" ] || [ "$OS_NAME" == "centos" ]; then
        OS_FAMILY="fedora"
    else
        OS_FAMILY="unknown"
    fi

    echo "Detected: $OS_NAME $OS_VERSION (Family: $OS_FAMILY)"
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

# Функция проверки запущен ли контейнер
check_container_running() {
    if docker ps --format '{{.Names}}' | grep -q '^funpaybors-container$'; then
        return 0  # Контейнер запущен
    else
        return 1  # Контейнер не запущен
    fi
}

# Функция проверки порта
check_port() {
    local port=$1
    if command -v ss &> /dev/null; then
        if ss -tuln | grep -q ":$port "; then
            return 0  # Порт занят
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tuln | grep -q ":$port "; then
            return 0  # Порт занят
        fi
    elif command -v lsof &> /dev/null; then
        if lsof -i :$port &> /dev/null; then
            return 0  # Порт занят
        fi
    fi
    return 1  # Порт свободен
}

# Функция извлечения API ключа из файла контейнера
extract_api_key() {
    local container_name="$1"
    local quiet_mode="${2:-false}"
    local max_wait=120  # Максимальное время ожидания в секундах
    local wait_interval=3  # Интервал проверки в секундах
    local attempts=$((max_wait / wait_interval))

    if [ "$quiet_mode" != "true" ]; then
        print_message "Ожидаем генерации API ключа..."
    fi

    for ((i=1; i<=attempts; i++)); do
        # Проверяем, работает ли еще контейнер
        if ! check_container_running; then
            if [ "$quiet_mode" != "true" ]; then
                print_error "Контейнер остановлен"
            fi
            return 1
        fi

        # Пробуем получить ключ из файла /app/api_key в контейнере
        if docker exec "$container_name" sh -c '[ -f /app/api_key ] && cat /app/api_key 2>/dev/null' > /tmp/api_key.tmp 2>/dev/null; then
            local api_key=$(cat /tmp/api_key.tmp 2>/dev/null | tr -d '\r\n' | xargs)

            if [ -n "$api_key" ] && [ "${#api_key}" -gt 5 ]; then
                echo "$api_key"
                rm -f /tmp/api_key.tmp 2>/dev/null
                return 0
            fi
        fi

        # Также проверяем логи
        local logs=$(docker logs --tail 20 "$container_name" 2>/dev/null)
        if echo "$logs" | grep -q "Your api key:"; then
            local api_key=$(echo "$logs" | grep "Your api key:" | tail -1 | sed -n 's/.*Your api key: //p' | tr -d '\r\n' | awk '{print $1}')

            if [ -n "$api_key" ] && [ "${#api_key}" -gt 5 ]; then
                echo "$api_key"
                return 0
            fi
        fi

        # Проверяем другие возможные расположения файла
        for path in "/app/api_key" "/api_key" "/data/api_key" "/app/data/api_key"; do
            if docker exec "$container_name" sh -c "[ -f '$path' ] && cat '$path' 2>/dev/null" > /tmp/api_key_check.tmp 2>/dev/null; then
                local api_key=$(cat /tmp/api_key_check.tmp 2>/dev/null | tr -d '\r\n' | xargs)
                if [ -n "$api_key" ] && [ "${#api_key}" -gt 5 ]; then
                    echo "$api_key"
                    rm -f /tmp/api_key_check.tmp 2>/dev/null
                    return 0
                fi
            fi
        done
        rm -f /tmp/api_key_check.tmp 2>/dev/null

        # Ждем перед следующей проверкой
        sleep $wait_interval

        if [ "$quiet_mode" != "true" ] && [ $((i % 5)) -eq 0 ]; then
            print_info "Ожидание API ключа... ($((i * wait_interval))/$max_wait секунд)"
        fi
    done

    if [ "$quiet_mode" != "true" ]; then
        print_warning "API ключ не найден в отведенное время"
        print_info "Попробуйте проверить вручную:"
        print_info "1. docker exec funpaybors-container ls -la /app/"
        print_info "2. docker exec funpaybors-container cat /app/api_key 2>/dev/null || echo 'Файл не найден'"
        print_info "3. docker logs --tail 50 funpaybors-container"
    fi
    return 1
}

# Функция быстрого получения API ключа
quick_get_api_key() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker не установлен"
        return 1
    fi

    if ! check_existing_container; then
        print_error "Контейнер funpaybors-container не найден"
        return 1
    fi

    # Запускаем контейнер если он остановлен
    if ! check_container_running; then
        print_message "Контейнер остановлен. Запускаем..."
        if docker start funpaybors-container > /dev/null 2>&1; then
            print_message "✓ Контейнер запущен"
            sleep 8  # Даем время приложению запуститься
        else
            print_error "Не удалось запустить контейнер"
            return 1
        fi
    fi

    API_KEY=$(extract_api_key "funpaybors-container" "true")

    if [ -n "$API_KEY" ]; then
        echo ""
        print_success "╔═══════════════════════════════════════════════════════╗"
        print_success "║                    API КЛЮЧ                           ║"
        print_success "╠═══════════════════════════════════════════════════════╣"
        print_success "║ $API_KEY"
        print_success "╚═══════════════════════════════════════════════════════╝"
        echo ""

        # Сохраняем ключ в файл
        echo "$API_KEY" > /tmp/funpaybors_api_key.txt
        chmod 600 /tmp/funpaybors_api_key.txt

        # Пытаемся скопировать в буфер обмена
        if command -v xclip &> /dev/null; then
            echo -n "$API_KEY" | xclip -selection clipboard
            print_message "✓ Ключ скопирован в буфер обмена (xclip)"
        elif command -v xsel &> /dev/null; then
            echo -n "$API_KEY" | xsel --clipboard --input
            print_message "✓ Ключ скопирован в буфер обмена (xsel)"
        elif command -v wl-copy &> /dev/null; then
            echo -n "$API_KEY" | wl-copy
            print_message "✓ Ключ скопирован в буфер обмена (wl-copy)"
        fi
        return 0
    else
        print_error "Не удалось получить API ключ"
        print_info "Попробуйте проверить вручную:"
        print_info "  docker exec funpaybors-container ls -la /app/"
        print_info "  docker exec funpaybors-container cat /app/api_key 2>/dev/null || echo 'Файл не найден'"
        print_info "  docker logs --tail 30 funpaybors-container"
        return 1
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
        if check_container_running; then
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
        print_info "  7) Показать API ключ"
        print_info "  8) Проверить наличие файла api_key"
        print_info "  9) Продолжить установку без изменений (выйти из меню)"
        print_info "  10) Выйти из скрипта"
        echo ""

        read -p "Ваш выбор (1-10): " choice

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
                    print_message "Подождите 10 секунд для полного запуска..."
                    sleep 10
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
                    print_message "Подождите 10 секунд для полного запуска..."
                    sleep 10
                else
                    print_error "Не удалось запустить контейнер."
                fi
                ;;
            7)
                echo ""
                if check_container_running; then
                    print_message "Извлекаем API ключ из файла /app/api_key..."
                    API_KEY=$(extract_api_key "funpaybors-container")

                    if [ -n "$API_KEY" ]; then
                        echo ""
                        print_success "╔═══════════════════════════════════════════════════════╗"
                        print_success "║                    API КЛЮЧ                           ║"
                        print_success "╠═══════════════════════════════════════════════════════╣"
                        print_success "║ $API_KEY"
                        print_success "╚═══════════════════════════════════════════════════════╝"
                        echo ""
                        print_message "API ключ скопирован в буфер обмена (если доступно) и файл."

                        # Сохраняем ключ в файл
                        echo "$API_KEY" > /tmp/funpaybors_api_key.txt
                        chmod 600 /tmp/funpaybors_api_key.txt

                        # Пытаемся скопировать в буфер обмена (для Linux)
                        if command -v xclip &> /dev/null; then
                            echo -n "$API_KEY" | xclip -selection clipboard
                            print_message "✓ Ключ скопирован в буфер обмена (xclip)"
                        elif command -v xsel &> /dev/null; then
                            echo -n "$API_KEY" | xsel --clipboard --input
                            print_message "✓ Ключ скопирован в буфер обмена (xsel)"
                        elif command -v wl-copy &> /dev/null; then
                            echo -n "$API_KEY" | wl-copy
                            print_message "✓ Ключ скопирован в буфер обмена (wl-copy)"
                        fi
                    else
                        print_error "Не удалось извлечь API ключ."
                        print_info "Попробуйте проверить вручную:"
                        print_info "  docker exec funpaybors-container ls -la /app/"
                        print_info "  docker exec funpaybors-container cat /app/api_key 2>/dev/null || echo 'Файл не найден'"
                    fi
                else
                    print_error "Контейнер не запущен. Запустите его сначала."
                fi
                ;;
            8)
                echo ""
                if check_existing_container; then
                    print_message "Проверяем файлы в контейнере..."
                    echo "═══════════════════════════════════════════════════════"
                    print_info "Содержимое директории /app/:"
                    docker exec funpaybors-container ls -la /app/ 2>/dev/null || print_error "Не удалось выполнить команду в контейнере"
                    echo ""
                    print_info "Попытка чтения /app/api_key:"
                    docker exec funpaybors-container cat /app/api_key 2>/dev/null || print_error "Файл /app/api_key не найден или недоступен"
                    echo "═══════════════════════════════════════════════════════"
                else
                    print_error "Контейнер не найден"
                fi
                ;;
            9)
                echo ""
                print_message "Продолжаем установку без изменений..."
                return 0  # Вернем 0 чтобы пропустить установку
                ;;
            10)
                echo ""
                print_message "Выход из скрипта."
                exit 0
                ;;
            *)
                print_error "Неверный выбор. Пожалуйста, выберите 1-10."
                ;;
        esac
    done
}

# Функция установки Docker на Debian/Ubuntu
install_docker_debian() {
    print_message "Установка Docker для Debian/Ubuntu..."

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
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Определяем кодовое имя дистрибутива
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [ -n "$VERSION_CODENAME" ]; then
            CODENAME=$VERSION_CODENAME
        else
            CODENAME=$(echo "$VERSION" | grep -oP '(?<=\().+?(?=\))' | head -1)
        fi
    fi

    # Если не удалось определить кодовое имя, используем lsb_release
    if [ -z "$CODENAME" ] && command -v lsb_release &> /dev/null; then
        CODENAME=$(lsb_release -cs)
    fi

    # Если все еще пусто, используем fallback
    if [ -z "$CODENAME" ]; then
        print_warning "Не удалось определить кодовое имя дистрибутива, используем 'jammy'"
        CODENAME="jammy"
    fi

    # Добавление репозитория Docker
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $CODENAME stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Установка Docker
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
}

# Функция установки Docker на Fedora/RHEL
install_docker_fedora() {
    print_message "Установка Docker для Fedora/RHEL..."

    # Установка зависимостей
    dnf -y install dnf-plugins-core

    # Добавление репозитория Docker
    dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo

    # Установка Docker
    dnf -y install docker-ce docker-ce-cli containerd.io docker-compose-plugin

    # Настройка SELinux (если включен)
    if command -v getenforce &> /dev/null && [ "$(getenforce)" = "Enforcing" ]; then
        print_message "Настройка SELinux для Docker..."
        setenforce 0
        sed -i 's/SELINUX=enforcing/SELINUX=permissive/g' /etc/selinux/config
    fi
}

# Основная функция установки Docker
install_docker() {
    detect_distro

    print_message "1. Проверяем установлен ли Docker..."

    if command -v docker &> /dev/null; then
        print_message "✓ Docker уже установлен"
        return 0
    fi

    print_message "Устанавливаем Docker..."

    case $OS_FAMILY in
        "debian")
            install_docker_debian
            ;;
        "fedora")
            install_docker_fedora
            ;;
        *)
            print_error "Неподдерживаемый дистрибутив: $OS_NAME"
            print_info "Пожалуйста, установите Docker вручную:"
            print_info "https://docs.docker.com/engine/install/"
            exit 1
            ;;
    esac

    # Проверка установки
    if command -v docker &> /dev/null; then
        print_message "✓ Docker успешно установлен"
        return 0
    else
        print_error "Не удалось установить Docker"
        exit 1
    fi
}

# Функция запуска службы Docker
start_docker_service() {
    print_message "2. Запускаем службу Docker..."

    case $OS_FAMILY in
        "debian")
            systemctl enable docker --now > /dev/null 2>&1
            ;;
        "fedora")
            systemctl enable docker --now > /dev/null 2>&1
            # Для Fedora может потребоваться дополнительная настройка
            if [ "$OS_NAME" = "fedora" ]; then
                groupadd docker 2>/dev/null || true
                usermod -aG docker $SUDO_USER 2>/dev/null || true
            fi
            ;;
    esac

    # Проверяем, что Docker запущен
    if systemctl is-active --quiet docker; then
        print_message "✓ Служба Docker запущена"
    else
        print_warning "Служба Docker не запущена, пытаемся запустить..."
        systemctl start docker 2>/dev/null || service docker start 2>/dev/null
        sleep 3
    fi
}

# Проверка аргументов командной строки
if [ "$1" = "--get-api-key" ] || [ "$1" = "-k" ]; then
    quick_get_api_key
    exit $?
fi

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
print_info "Поддерживаемые дистрибутивы: Ubuntu, Debian, Fedora"
print_info "Использование:"
print_info "  sudo $0                   # Полная установка"
print_info "  sudo $0 --get-api-key    # Быстрое получение API ключа"
print_info "  sudo $0 -k               # Быстрое получение API ключа"
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

# 1. Установка Docker
install_docker

# 2. Запуск службы Docker
start_docker_service

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

# Проверка занятости порта
if check_port "$PORT"; then
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
if eval "$CMD"; then
    print_message "✓ Контейнер успешно запущен!"
else
    print_error "Не удалось запустить контейнер"
    exit 1
fi

# 7. Ожидание появления API ключа в файле
print_message "7. Ожидаем запуска приложения и генерацию API ключа..."
print_info "Приложение создает файл /app/api_key внутри контейнера"
print_info "Это может занять до 2 минут..."

API_KEY=$(extract_api_key "funpaybors-container")

# 8. Проверка статуса
print_message "8. Проверяем статус контейнера..."

echo ""
print_message "Статус контейнера:"
docker ps --filter "name=funpaybors-container" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 9. Итоговая информация
clear_screen
print_message "==================================================="
print_message "      УСТАНОВКА УСПЕШНО ЗАВЕРШЕНА!                 "
print_message "==================================================="
echo ""
print_message "Контейнер 'funpaybors-container' запущен с параметрами:"
echo ""
print_message "  • Образ: k1p1kcode/funpaybors"
print_message "  • GOLDEN_KEY: [установлен]"
print_message "  • Порт хоста: $PORT"
print_message "  • Порт контейнера: 58899"
if [ -n "$VOLUME_PATH" ]; then
    print_message "  • Данные сохраняются в: $VOLUME_PATH"
fi
print_message "  • Автоперезапуск: включен"
print_message "  • API ключ сохраняется в: /app/api_key внутри контейнера"

if [ -n "$API_KEY" ]; then
    echo ""
    print_success "╔═══════════════════════════════════════════════════════╗"
    print_success "║                   ВАШ API КЛЮЧ                        ║"
    print_success "╠═══════════════════════════════════════════════════════╣"
    print_success "║ $API_KEY"
    print_success "╚═══════════════════════════════════════════════════════╝"
    echo ""
    print_message "⚠️  СОХРАНИТЕ ЭТОТ КЛЮЧ! ОН ПОТРЕБУЕТСЯ ДЛЯ РАБОТЫ С ПАНЕЛЬЮ"
    print_message "Ключ также доступен внутри контейнера по пути: /app/api_key"

    # Сохраняем ключ в файл на хосте
    KEY_FILE="/opt/funpaybors_api_key_$(date +%Y%m%d_%H%M%S).txt"
    echo "$API_KEY" > "$KEY_FILE"
    chmod 600 "$KEY_FILE"
    print_message "✓ Ключ сохранен в файл: $KEY_FILE"

    # Также сохраняем ключ в доступное место
    echo "$API_KEY" > /tmp/funpaybors_api_key.txt
    chmod 600 /tmp/funpaybors_api_key.txt

    # Пытаемся скопировать в буфер обмена
    if command -v xclip &> /dev/null; then
        echo -n "$API_KEY" | xclip -selection clipboard
        print_message "✓ Ключ скопирован в буфер обмена (xclip)"
    elif command -v xsel &> /dev/null; then
        echo -n "$API_KEY" | xsel --clipboard --input
        print_message "✓ Ключ скопирован в буфер обмена (xsel)"
    elif command -v wl-copy &> /dev/null; then
        echo -n "$API_KEY" | wl-copy
        print_message "✓ Ключ скопирован в буфер обмена (wl-copy)"
    fi
else
    echo ""
    print_warning "API ключ не был получен автоматически."
    print_info "Вы можете получить его вручную следующими способами:"
    print_info "1. docker exec funpaybors-container cat /app/api_key"
    print_info "2. docker logs --tail 50 funpaybors-container"
    print_info "3. Перезапустите контейнер и попробуйте снова"
    print_info ""
    print_info "Или используйте команду позже:"
    print_info "  sudo $0 --get-api-key"
fi

print_message "==================================================="

# Создаем файл с информацией о запуске
INFO_FILE="/tmp/funpaybors_install_$(date +%Y%m%d_%H%M%S).txt"
cat > "$INFO_FILE" << EOF
Информация об установке funpaybors
Дата установки: $(date)
Дистрибутив: $OS_NAME $OS_VERSION
----------------------------------------
Контейнер: funpaybors-container
Образ: k1p1kcode/funpaybors
Порт: $PORT
GOLDEN_KEY: [установлен]
API ключ: ${API_KEY:-не получен (проверьте /app/api_key внутри контейнера)}
Путь к данным: ${VOLUME_PATH:-не настроен}
Команда запуска: $CMD
----------------------------------------
Команды управления:
  Просмотр логов: docker logs -f funpaybors-container
  Получить API ключ: docker exec funpaybors-container cat /app/api_key
  Быстрое получение ключа: sudo $0 --get-api-key
  Проверить файлы в контейнере: docker exec funpaybors-container ls -la /app/
  Переустановка: docker rm -f funpaybors-container && sudo ./$(basename "$0")
  Остановка: docker stop funpaybors-container
  Запуск: docker start funpaybors-container
EOF

print_message "Информация об установке сохранена в: $INFO_FILE"
print_message "==================================================="

# Предлагаем проверить файлы в контейнере
echo ""
read -p "Показать содержимое директории /app/ в контейнере? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "═══════════════════════════════════════════════════════"
    docker exec funpaybors-container ls -la /app/ 2>/dev/null || print_error "Не удалось выполнить команду"
    echo "═══════════════════════════════════════════════════════"
fi