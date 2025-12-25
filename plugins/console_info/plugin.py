from base import BasePlugin


class Plugin(BasePlugin):
    from base import default_hook

    @staticmethod
    def load() -> None:
        print("Console info, load!")

    @staticmethod
    @default_hook
    async def message_hook(message: dict, me: dict) -> bool:
        from datetime import datetime

        text_sender = (
            f"Я ответил: {message['text']}"
            if me["id"] == message["author_id"]
            else f"Нам написали {message['author_id']}: {message['text']}"
        )
        date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[СООБЩЕНИЕ: {date}] {text_sender}")
        return False

    @staticmethod
    @default_hook
    async def order_hook(order: dict | str, me: dict | str) -> bool:
        print(order)
        return True
