# Важно
- *Важно это максимальна сырая функция которая будет дорабатываться и расширяться*
- *В скором времени будет полная поддержка хуков на данный момент только один*
_____

# Начало
Установите python 3.13.2 до 3.13.6
## Настройка
1. Установите версию из realese под которую хотите начать разработку лучше всего выбирать последни или самую стбильную на момент написание данного урока нету стабильный)) откройте консоль
2. Создайте рядом с исполняемом файлом папку /plugins 
3. Создайте виртуальное окружение в папке plugins с названием venv важно
4. Придумайте уникальное название плагину и назовите так папку в /plugins
5. Перейдите в новую папку все дальнейшие действия происходят там
6. Создайте файл plugin.py это входной файл 
7. В этом файле создайте класс Plugin

## Хуки
За короткое время добавиться очень много хуков

Хук load отвечает за выполнение кода при старте скрипта

Все остальные хуки асинхроные


<table>
		<tr>
			<td>Название</td>
			<td>Описание</td>
			<td>Входные данные</td>
		</tr>
		<tr>
			<td>message_hook</td>
			<td>Получает данные о новом сообщение </td>
			<td>id: int, chat_id: str, chat_name: Option, text: Option, interlocutor_id: Option, author_id: int,</td>
		</tr>
		<tr>
			<td>order_hook</td>
			<td>Получает данные о новом заказе</td>
			<td>id: str, description: str, price: float, currency: 
			str, buyer_username: str, buyer_id: str, 
			chat_id: str, status: Literal['Paid', 'Closed', 'Refunded'], date_text: str, subcategory: Dict["id": Option, "name": String]</td>
		</tr>
		<tr>
			<td>order_status_changed_hook</td>
			<td>Получает данные о новом заказе которой изменили</td>
			<td>order_hook</td>
		</tr>
</table>


Массивные данные(которые даются каждому хуку)
me: str - golden_key: str, id: int

*Выходные данные из хука это bool* 
- True - Хендлер проходит по всем остальным хукам (по всем плагином)
- False - Плагин говорит я забираю данный хендлер дальше его не раздавай
- Понятное дело несколько хуков из разных плагинов могут читать одно и тот же хук важное что играет ключевою роль это добавление в папку чем выше сортирует ос папку тем первее она будет в вызове хуков

Интересная пометка 

author_id - 500

author_id - 0

Это система FunPay

## Использование хуков
```python
class Plugin():
    @staticmethod
    def load() -> None:
        print("Hi plugin async_chats_tg, load!")

    @staticmethod
    async def message_hook(*args) -> bool:
        return True
```
Вы могли заметить то что мы используем *args на входе дело в том то что Rust отдает в кортеже (данные для хука, *масивные данные)
Ну еще важно заметить то что при args мы получаем данные в str но их можно спрасить с помощью json.loads
Но я советую использовать base.py из [plugin_exempel](https://github.com/k1p1k-code/FunPayBORS/tree/master/plugin_exempel)

- Его необходимо положить в папку с plugin.py или поддиректории
- Дальше необходимо его импортировать, но важно производить импорты где мы будем использовать нам нужен дикоратор из base так что мы импортируем в class Plugin

```python
class Plugin():
    from base import default_hook
    @staticmethod
    def load() -> None:
        print("Hi plugin async_chats_tg, load!")

    @staticmethod
    @default_hook
    async def message_hook(message: dict, me: dict) -> bool:
        return True
```
Абстракции для подсказок IDE

__Выходные данные c абстракцией будет False__
```python
from base import BasePlugin
class Plugin(BasePlugin):
    import sys
    from base import  default_hook #Читать ниже
    @staticmethod
    def load() -> None:
        print("Hi plugin async_chats_tg, load!")

    @staticmethod
    @default_hook
    async def message_hook(message: dict, me: dict) -> bool:
        return True

    @staticmethod
    @default_hook
    async def order_hook(order: dict | str, me: dict | str) -> bool:
        print(order)
        return True
```


Что делать если мы хотим воспользоваться любой библиотекой из venv или стандартной в хуке то необходимо импортировать в саму функцию

Мне для создание системы плагинов необходимо было посмотреть все пути в sys.path
```python
from base import BasePlugin

class Plugin(BasePlugin):
    from base import default_hook 
    @staticmethod
    def load() -> None:
        print("Hi plugin async_chats_tg, load!")

    @staticmethod
    @default_hook
    async def message_hook(message: dict, me: dict) -> bool:
        import sys
        print(sys.path)
        return True

    @staticmethod
    @default_hook
    async def order_hook(order: dict | str, me: dict | str) -> bool:
        print(order)
        return True
```

В load с помощью библиотеке pip необходимо установить все зависимости

Для продвинутых знаний вы можете создавать venv в своей директории 
важно то что это потребляет больше ресурсов если у вас легкая библиотека делать это не стоит

*Теперь вы можете создавать плагины на python для бота на funpay написанном на Rust*

## Удобный запуск и редактирование
1. Советую использовать VS code
2. Используйте наше виртуальное окружение в VS(/plugins/venv)
3. Запустите проект где поддерживаться server по -sock ```FunPayBors_64x.exe -gk {key} --server```
4. Советую добавить exe в глобальные пути 
5. Теперь мы можем использовать из другой консоли```FunPayBors_64x.exe --reload```

Данная команда по сокетам отправит запрос запущенному приложению о перезагрузки плагинов, не запускайте с флагом --server в продакшейне так как любой желающий знающий порт(его можно найти в исходном коде данного проекта) сможет отправить запрос для reload или изолируйте порт 58899

## Сохранение данных

Самый простой способ это создать аргумент в функции по умполчанию
```python
@staticmethod
@default_hook
    async def message_hook(message: dict, me: dict, st={"text": list()}) -> bool:
    st["text"].append(message["text"])
    print(st)
```
Но возникает проблема то что хуки не смогут между собой общаться ради решение этой проблемы Rust сохраняет глобальную переменую storage если такая есть и отдает ее напрямую в функцию

``` python
from base import BasePlugin

storage = {"text": list()}

class Plugin(BasePlugin):
    from base import default_hook

    @staticmethod
    def load() -> None:
        print("Console info, load!")

    @staticmethod
    @default_hook
    async def message_hook(message: dict, me: dict) -> bool:
        storage["text"].append(message["text"])
        print(storage)
        return False
```
Если storage не определена в глобальной видимости то она не будет передоваться. Напоминаю rust вызывает только функци без сохранение данных, которые не в ее видимости

Переменая должна называться строго storage, туда можно сохранить любой тип данных, rust сохраняет ссылку на нее
