import { AbstractApp, AppManager, Collection } from "@nodeknit/app-manager";
import { Telegraf, Markup, Context } from 'telegraf';
import { spawn } from 'child_process';

export class AppTelegramBot extends AbstractApp {
    appId: string = "app-telegram-bot";
    name: string = "Telegram Bot App";

    private bot: Telegraf | null = null;

    constructor(appManager: AppManager) {
        super(appManager);
    }

    async mount(): Promise<void> {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            console.warn('TELEGRAM_BOT_TOKEN not set, Telegram bot will not work');
            return;
        }

        this.bot = new Telegraf(token);

        console.log('Telegram bot initialized with Telegraf');

        // Запустить бота
        this.bot.launch();
        console.log('Telegram bot launched');

        const webAppUrl = process.env.TG_WEB_APP_URL;

        if (process.env.NODE_ENV === 'development') {
            console.log('Development mode detected, starting localhost.run tunnel...');
            const tunnel = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-R', '80:localhost:17280', 'nokey@localhost.run']);

            tunnel.stdout.on('data', (data) => {
                const output = data.toString();
                console.log('localhost.run tunnel stdout:', output);
                const match = output.match(/https:\/\/[^\s]+/);
                if (match) {
                    const tunnelUrl = match[0];
                    console.log('Extracted tunnel URL:', tunnelUrl);
                    this.setMenuButton(tunnelUrl);
                } else {
                    console.log('No URL found in output');
                }
            });

            tunnel.stderr.on('data', (data) => {
                console.error('localhost.run tunnel stderr:', data.toString());
            });

            tunnel.on('close', (code) => {
                console.log('localhost.run tunnel process closed with code:', code);
            });

            tunnel.on('error', (error) => {
                console.error('localhost.run tunnel process error:', error);
            });

            // Timeout in case URL not received
            setTimeout(() => {
                if (!webAppUrl) {
                    console.log('Timeout: URL not received and no TG_WEB_APP_URL set');
                }
            }, 10000);
        } else {
            console.log('Production mode');
            if (webAppUrl) {
                await this.setMenuButton(webAppUrl);
            } else {
                console.warn('TG_WEB_APP_URL not set, menu button will not be configured');
            }
        }

        // Установить команды меню бота с web_app только если URL есть
        if (webAppUrl) {
            await this.bot.telegram.setMyCommands([
                { command: 'start', description: 'Запустить бота и открыть mini app' }
            ]);
            console.log('Bot commands menu set');
        } else {
            console.warn('TG_WEB_APP_URL not set, bot commands will not include web app');
        }

        // Обработчик команды /start
        this.bot.command('start', (ctx: Context) => {
            const welcomeMessage = `🌟 Добро пожаловать!`;

            if (webAppUrl) {
                ctx.reply(welcomeMessage, Markup.inlineKeyboard([
                    Markup.button.webApp('🚀 Открыть приложение', `${webAppUrl}?startapp=start`)
                ]));
            } else {
                ctx.reply(welcomeMessage);
            }
        });

        // Обработчик сообщений: отправить кнопку для открытия mini app
        this.bot.on('text', (ctx: Context) => {
            console.log('Received message:', (ctx.message as any).text);
            if (webAppUrl) {
                ctx.reply('Открываем mini app:', Markup.inlineKeyboard([
                    Markup.button.webApp('Открыть Mini App', `${webAppUrl}?startapp=start`)
                ]));
            }
        });
    }

    private async setMenuButton(url: string) {
        try {
            //@ts-ignore
            await this.bot.telegram.setChatMenuButton({
                menuButton: {
                    type: 'web_app',
                    text: 'Открыть Mini App',
                    web_app: { url: `${url}?startapp=start` }
                }
            });
            console.log('Chat menu button set to open mini app at', url);
        } catch (error) {
            console.error('Error setting menu button:', error);
        }
    }

    async unmount(): Promise<void> {
        if (this.bot) {
            this.bot.stop();
            console.log('Telegram bot stopped');
        }
    }
}

// Default export
export default AppTelegramBot;
