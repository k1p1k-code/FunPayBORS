from plugin_base import BasePlugin
from aiogram import Bot

class ApplicationBot:
    def __init__(self):
        self.bot: Bot | None = None
        self.token_bot: str | None=None
        self.admin_id: int | None = None
        self.work: bool=False

    async def signal_off(self):
        self.work=False

    def run_bot_in_thread(self, bot):
        import threading
        def bot_thread():
            from bot import start_bot
            import asyncio

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(start_bot(bot, self.signal_off, self.admin_id))
            finally:
                loop.close()
        bot_thread = threading.Thread(
            target=bot_thread, 
            name="TelegramBotThread",
            daemon=True,
        )
        bot_thread.start()
        self.work=True

    def save(self):
        import json
        from pathlib import Path
        path=Path.cwd().joinpath("plugins").joinpath("AiogramLinker").joinpath("config.json")
        json.dump({
            "token_bot": self.token_bot,
            "admin_id": self.admin_id
        },
        open(path, 'w', encoding="UTF-8")
        )


storage = ApplicationBot()

class Plugin(BasePlugin):
    from plugin_base import default_hook
    @staticmethod
    def load():
        import json
        from pathlib import Path
        from aiogram import Bot

        path = Path.cwd().joinpath("plugins").joinpath("AiogramLinker").joinpath("config.json")
        config: dict = json.load(open(path, 'r', encoding="UTF-8"))
        token = config.get('token_bot')
        storage.token_bot = config.get('token_bot')
        storage.admin_id = config.get('admin_id')
        if token:
            try:
                storage.bot=Bot(token)
            except Exception as _:
                storage.bot=None
        else:
            storage.bot=None
        print("[AiogramLinker] Rus: Данный плагин является примером, как можно сделать связку с aiogram с помощью плагина")
        print("[AiogramLinker] Eng:This plugin is an example of how you can make a link with aiogram using a plugin")

    @staticmethod
    def reload():
        import json
        from pathlib import Path
        from aiogram import Bot
        import threading

        
        path = Path.cwd().joinpath("plugins").joinpath("AiogramLinker").joinpath("config.json")
        config: dict = json.load(open(path, 'r', encoding="UTF-8"))

        storage.token_bot = config.get('token_bot')
        token = config.get('token_bot')
        if token:
            try:
                storage.bot=Bot(token)
            except Exception as _:
                storage.bot=None
        else:
            storage.bot=None

        storage.admin_id = config.get('admin_id')
        for i in threading.enumerate():
            if i.name == "TelegramBotThread":
                storage.work=True

    @staticmethod
    async def build_menu():

        async def callback_input_set_bot(input: str):
            from aiogram import Bot
            try:
                storage.bot=Bot(input)
                storage.token_bot=input
            except Exception as _:
                return "Токен не валидный"
            return "Успешно"


        async def callback_input_set_admin_id(input: str):
            try:
                storage.admin_id=int(input)
            except Exception as _:
                return "ID не валидный"
            return "ID привязан"

        async def callback_button_start():
            if storage.work:
                return "Бот запущен\nНеобходимо отключить бота: /disconnect"
            if not(storage.admin_id and storage.bot and storage.token_bot):
                return "Заполните данные"
            
            storage.work=True
            storage.save()
            try:
                storage.run_bot_in_thread(bot=storage.bot)
            except Exception as _:
                return "Ошибка"
            return "Необходимо проверить командой: /start\nБот запущен"


        from plugin_base.menu import Menu, OptionInput, OptionText, OptionButton
        menu=Menu()
        if storage.work:
            menu.text.append(OptionText(
                value="Запущен, прописать в бота: /disconnect - отключить"
            ))

        place_bot= storage.bot.token if storage.bot else "No set"
        menu.input.append(OptionInput(
            value_placeholder=f"Token bot: {place_bot}",
            value_button="Apply",
            callback=callback_input_set_bot
        ))

        place_admin_id= storage.admin_id if storage.admin_id else "No set"
        menu.input.append(OptionInput(
            value_placeholder=f"Admin ID: {place_admin_id}",
            value_button="Apply",
            callback=callback_input_set_admin_id
        ))
        if not storage.work:
            menu.button.append(OptionButton(
                value="Start",
                callback=callback_button_start
        ))
        return menu

