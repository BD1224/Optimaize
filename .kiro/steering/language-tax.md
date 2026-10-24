# Language tax: what we do and don't save

The niche of Optimaize is non-English users who pay more tokens for the same content. This file records whether the design actually reduces that cost.

## What v1 does

- **English system prompts**, **prompt trimming**, and **auto-summarizing long chats** all cut tokens.
- None of them changes the extra cost of the user's own non-English text.
- The **router** saves money by picking cheaper models. That is language-agnostic, so it is not a language-tax feature.

Conclusion: v1 only partly reduces the language tax. Only translating through English attacks it directly (see below), and v1 does not do that.

## Router and languages

- The classifier gets the user's full text. It is not truncated, because the hard part of a message can be at the end.
- Claude reads non-English text fine, so the classifier does not translate.
- The classifier's own instructions stay in English: the fixed system prompt that tells Haiku how to rate difficulty is the same on every call, whatever language the user writes in, so it costs the same for everyone.

## Future optional feature: translate through English

Not built in v1. It is the `translateThroughEnglish` config flag, off by default.

**Flow:** translate the prompt to English, ask Claude, translate the answer back.

**Where the savings come from:** output tokens are the expensive part, and an English answer is cheaper than one in the user's language.

**Translator options:**
- Local and free (Argos Translate, NLLB, Opus-MT): private, but weaker on low-resource languages such as Haitian Creole.
- Free-tier cloud (DeepL, Google): sends the user's text to a third party, which breaks the principle that prompts never leave the machine except to Anthropic.
- Claude/Haiku as the translator: pays the language tax in both directions, so little is saved.

**Risks:**
- Meaning loss: idioms, names, tone, and medical or legal nuance can change.
- Latency: extra round trips before the user sees anything.
- Streaming: the reply cannot be shown live unless it is translated in chunks, which hurts quality.
- Complexity: another component and more failure points.

It stays off for healthcare-adjacent use.

## Decision gate before building it

1. Measure the real gap on Claude's tokenizer, using Anthropic's token counting, for the target languages.
2. Build the feature only if the gap is large and local translation quality is acceptable.
