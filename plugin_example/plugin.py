
import  sys

class Plugin():
    from base import  message
    @staticmethod
    def load() -> None:
        print("Hi plugin async_chats_tg, load!")

    @staticmethod
    @message
    async def message_hook(message: dict, me: dict) -> bool:
        return True
