import  json

from functools import wraps
from abc import ABC
from typing import List



class BasePlugin(ABC):
    @staticmethod
    def load() -> None:
        pass

    @staticmethod
    async def message_hook(message: dict | str, me: dict | str) -> bool:
        return False

    @staticmethod
    async def order_hook(order: dict | str, me: dict | str) -> bool:
        return False

    @staticmethod
    async def build_menu() -> List[dict]:
        return []

def default_hook(func):
    @wraps(func)
    async def wrapper(*args):
        args_with_dict=list()
        for i in args:
            args_with_dict.append(json.loads(i))
        return await func(*args_with_dict)
    return wrapper

