import  json

import json
from functools import wraps
import  sys



def message(func):
    @wraps(func)
    async def wrapper(*args):
        args_with_dict=list()
        for i in args:
            args_with_dict.append(json.loads(i))
        return await func(*args_with_dict)
    return wrapper

