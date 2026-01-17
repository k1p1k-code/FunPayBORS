from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart

async def start_bot(bot: Bot, signal_off: callable, admin_id: int):
    dp=Dispatcher()
    @dp.message(CommandStart())
    async def cmd_start(message: types.Message):
        await message.answer(
            "AiogramLinker\n"
            "Вы используйте пример связки\n\n"
            "Отвезать бота: /disconnect"
            )

    @dp.message(F.text == "/disconnect")
    async def msg(message: types.Message):
        await message.answer("Бот, был выключен")
        await dp.stop_polling()
        await signal_off()
    await dp.start_polling(bot)