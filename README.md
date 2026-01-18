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

### Translating (Context Menu)
1.  Select text in an email you want to translate.
2.  Right-click the selection.
3.  Click **InboxAI-Translate**.
4.  The translation will appear in a popup window.

## Source Code & Build Instructions

### Prerequisites

*   **Operating System**: Linux preferred (tested on Ubuntu), but cross-platform (Windows/macOS) compatible given standard tools.
*   **Tools**: `zip` (Info-ZIP) utility.
*   **Node.js/NPM**: Not used for building/transpilation (Vanilla JS). Used only for development convenience if any.

### Build Script

The project includes a `build.sh` script for Linux/macOS.

1.  Open a terminal in the project root.
2.  Run the build script:

    ```bash
    ./build.sh
    ```

    This will generate `thunderbird-ai-plugin.xpi` in the same directory.

### Manual Build Instructions

If you prefer to build manually or are on Windows without a bash environment:

1.  Navigate to the project root directory.
2.  Select all files **except**:
    *   `.git/` (and `.gitignore`)
    *   `.DS_Store`
    *   `build.sh`
    *   `*.xpi`
3.  Zip the selected content.
    *   **Command Line**: `zip -r thunderbird-ai-plugin.xpi . -x "*.git*" -x "*.DS_Store*" -x "build.sh"`
4.  Rename the result to `thunderbird-ai-plugin.xpi`.

## License

Mozilla Public License 2.0
