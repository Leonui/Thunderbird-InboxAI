# InboxAI - Thunderbird AI Assistant

InboxAI is a Thunderbird MailExtension that leverages AI to supercharge your email experience. It helps you write, polish, and translate emails directly within Thunderbird.

## Features

- **Write**: Provide a prompt, and InboxAI will draft an email for you.
- **Polish**: Refine your existing drafts to be professional, clear, and concise.
- **Translate**: Translate incoming emails into your preferred language instantly.
- **Multi-Provider Support**: Built-in support for OpenAI and DeepSeek, plus a Custom option for other OpenAI-compatible APIs.

## Installation

### From XPI File (Recommended)
1.  Download the latest `thunderbird-ai-plugin.xpi` file.
2.  Open **Thunderbird**.
3.  Go to **Tools** -> **Add-ons and Themes**.
4.  Click the **Gear icon** (top right) -> **Install Add-on From File...**.
5.  Select the `.xpi` file and follow the prompts.

## Configuration

Before using InboxAI, you must configure your AI provider settings:

1.  Open the **Add-ons Manager**.
2.  Click the **Wrench icon** (Options) next to **InboxAI**.
3.  Select your **Provider**:
    - **OpenAI**: Requires an OpenAI API Key.
    - **DeepSeek**: Requires a DeepSeek API Key.
    - **Custom**: Enter your own Base URL and Model Name.
4.  Enter your **API Key**.
5.  Click **Test Connection** to verify your settings.
6.  Click **Save Settings**.

## Usage

### Writing & Polishing (Compose Window)
1.  Open a **Write** window.
2.  Click the **InboxAI Assistant** button in the toolbar.
3.  **Write New**: Enter a topic/prompt and click "Write Draft".
4.  **Polish**: Type your draft in the email body, then click "Polish Draft".
5.  The result will appear in the popup. Click **Copy to Clipboard** and paste it into your email.

### Translating (Message Window, NOT WORKING YET)
1.  Open an email you want to translate.
2.  Click the **InboxAI Translate** button in the message header toolbar.
3.  Enter the target language (default is English) and click **Translate**.

## Building

To package the extension into an `.xpi` file:

```bash
zip -r ./thunderbird-ai-plugin.xpi . -x "*.git*" -x "*.DS_Store*"
```

## License

MIT
