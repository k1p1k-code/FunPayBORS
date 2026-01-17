# Важно
- *Важно это максимальна сырая функция которая будет дорабатываться и расширяться*
- *В скором времени будет полная поддержка хуков на данный момент только один*
_____

# Начало
Установите python 3.13.2 до 3.13.6
## Настройка
1. Установите версию из release под которую хотите начать разработку лучше всего выбирать последни или самую стабильную, откройте консоль
2. Создайте рядом с исполняемом файлом папку /plugins 
3. Создайте виртуальное окружение в папке plugins с названием venv важно
4. Придумайте уникальное название плагину и назовите так папку в /plugins
5. Перейдите в новую папку все дальнейшие действия происходят там
6. Создайте файл plugin.py это входной файл 
7. В этом файле создайте класс Plugin

## Хуки
### Обязательные (не асинхронные)
<table>
		<tr>
			<td>Название</td>
			<td>Описание</td>
			<td>Входные данные</td>
		</tr>
		<tr>
			<td>load</td>
			<td>При первом импорте плагина</td>
			<td>Пусто</td>
		</tr>
		<tr>
			<td>reload</td>
			<td>При перезагрузке плагинов</td>
			<td>Пусто</td>
		</tr>

</table>




### Необязательные (асинхронные)
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
В Python принимает данные от Rust. Данные приходят как строка в формате JSON. Для удобства используйте plugin_base — он уже содержит готовую обработку и взаимодействие. [plugin_exempel](https://github.com/k1p1k-code/FunPayBORS/tree/master/plugin_exempel)

- Его необходимо положить в папку с plugin.py или поддиректории
- Дальше необходимо его импортировать, но важно производить импорты где мы будем использовать нам нужен декоратор из base так что мы импортируем в class Plugin

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

Мне для создания системы плагинов необходимо было посмотреть все пути в sys.path
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

Самый простой способ это создать аргумент в функции по умолчанию
```python
@staticmethod
@default_hook
    async def message_hook(message: dict, me: dict, st={"text": list()}) -> bool:
    st["text"].append(message["text"])
    print(st)
```
Но возникает проблема то что хуки не смогут между собой общаться ради решения этой проблемы Rust сохраняет глобальную переменную storage если такая есть и отдает ее напрямую в функцию

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
Если storage не определена в глобальной видимости, то она не будет перековаться. Напоминаю rust вызывает только функции без сохранения данных, которые не в ее видимости

Переменная должна называться строго storage, туда можно сохранить любой тип данных, rust сохраняет ссылку на нее

# Работа с web interface

Для создания меню необходимо инициализировать переменную build_menu
```python
from plugin_base import BuilderMenu
class Plugin(BasePlugin):
    build_menu=BuilderMenu()
```
Добавление текста 
```python
from plugin_base import BuilderMenu
class Plugin(BasePlugin):
    build_menu=BuilderMenu()
    
    build_menu.add_text("Спасибо!")
```

Добавление кнопки

Мы можем использовать хранилище так же в callback интерфейса
```python
from plugin_base import BuilderMenu
class Plugin(BasePlugin):
    async def callback_button_info_cons():
        print(storage)
        print("Спасибо, за использование")
        
    build_menu=BuilderMenu()
    build_menu.add_button(callback_button_info_cons, "Kruto")
```
Создание окна ввода с кнопкой(callback)
```python
from plugin_base import BuilderMenu
class Plugin(BasePlugin):
    async def callback_input(input: str):
        print(storage)
        print(f"Ввод: {input}")
        
    build_menu=BuilderMenu()
    build_menu.add_input(callback=callback_input, value_placeholder="Токен от бота", value_button="Применить")
```

Пример динамического построения интерфейса: /plugin_example/AiogramLinker/plugin.py
