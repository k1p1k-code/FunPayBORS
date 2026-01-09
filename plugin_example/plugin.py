from plugin_base import BasePlugin

storage = {"text": list()}


class Plugin(BasePlugin):
    from plugin_base import default_hook
    from plugin_base import BuilderMenu
    

    @staticmethod
    def load() -> None:
        print("Console info, load!")


    async def callback_button_info_cons():
        print(storage)
        print("Спасибо, за использование")

    async def callback_input(input: str):
        print(storage)
        print(f"Ввод: {input}")

    build_menu=BuilderMenu()
    build_menu.add_input(callback=callback_input, value_placeholder="Токен от бота", value_button="Применить")
    build_menu.add_text("Спасибо!")
    build_menu.add_button(callback_button_info_cons, "Kruto")



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
# d=Plugin()