# X Reply Drafter (Chrome Extension)

AI-assisted reply drafting for X (twitter.com / x.com).

## Features
- Injects **Draft Reply** button on each post
- Reads author + post text (+ quote tweet text when present)
- Calls configurable AI endpoint (OpenAI, Anthropic, OpenAI-compatible)
- No popup/overlay: generated text is inserted directly into X's reply composer
- If reply composer is closed, it clicks the reply icon first, waits for composer, then inserts
- Button shows inline **Generating...** state during draft creation
- Settings page for API key, endpoint, model, and system prompt
- Manifest V3, mutation-observer based injection for X's dynamic timeline

## Install (Developer mode)
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `x-reply-drafter/`
5. Open extension options and configure API settings

## Provider notes
- **OpenAI-compatible** uses Chat Completions-style payload + `Authorization: Bearer ...`
- **Anthropic** uses Messages payload + headers `x-api-key` and `anthropic-version`
- Provider auto-detection:
  - endpoint contains `anthropic.com`, or
  - model starts with `claude`

## UX behavior
- Rate-limits draft generation requests (~1.5s minimum spacing)
- Handles timeline re-renders via debounced mutation observer
- Uses contenteditable insertion + input/change events so X picks up generated text
- Briefly surfaces insert/error state on the Draft Reply button label

## Default system prompt
> You are a witty, knowledgeable person on X. Write a concise, engaging reply. No hashtags. Match the conversational tone. Keep it under 280 characters unless the topic demands more depth.
