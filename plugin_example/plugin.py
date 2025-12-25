from base import BasePlugin


class Plugin(BasePlugin):
    from base import default_hook

    @staticmethod
    def load() -> None:
        print("Hi plugin async_chats_tg, load!")

    @staticmethod
    @default_hook
    async def message_hook(message: dict, me: dict) -> bool:
        from datetime import datetime

        text_sender = (
            f"я ответил: {message['text']}"
            if me["id"] == message["author_id"]
            else f"нам написали: {message['text']}"
        )
        date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[СООБЩЕНИЕ: {date}] {text_sender}")
        return True

    @staticmethod
    @default_hook
    async def order_hook(order: dict | str, me: dict | str) -> bool:
        print(order)
        return True
