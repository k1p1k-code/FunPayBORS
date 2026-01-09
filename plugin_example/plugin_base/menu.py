from typing import Callable, Awaitable, Any, List

class OptionText():
    def __init__(self, value):
        self.value=value


class OptionButton():
    def __init__(self, value, callback):
        self.value=value
        self.callback=callback

class OptionInput():
    def __init__(self, value_placeholder, value_button, callback):
        self.value_placeholder=value_placeholder
        self.value_button=value_button
        self.callback=callback

class Menu:
    def __init__(self):
        self.text: List[OptionText]=list()
        self.button: List[OptionButton]=list()
        self.input: List[OptionInput]=list()

class BuilderMenu():
    def __init__(self):
        self.menu=Menu()

    def add_text(self, value: str):
        self.menu.text.append(OptionText(value=value))

    def add_button(self, callback: Callable[[], Awaitable[Any]], value: str):
        self.menu.button.append(OptionButton(value=value, callback=callback))

    def add_input(self, callback: Callable[[], Awaitable[Any]], value_placeholder: str, value_button: str):
        self.menu.input.append(OptionInput(value_placeholder=value_placeholder, value_button=value_button, callback=callback))


    async def __call__(self) -> dict:
        return self.menu
