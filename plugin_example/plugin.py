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

    @staticmethod
    @default_hook
    async def order_status_changed_hook(order: dict, me: dict) -> bool:
        print(
            f"[ +{order['amount']}{order['currency']} ИЗМЕНЕНИЕ СТАТУСА] {order['buyer_id']} подтвердил заказ {order['id']}({order['description']})"
        )
        return False
