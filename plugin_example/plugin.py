from base import BasePlugin

class Plugin(BasePlugin):
    from base import  default_hook
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