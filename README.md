# Aniimo Team Tracker

Free desktop app for Aniimo (PC) to keep track of your teams and compare them with friends.

Unofficial fan project, not affiliated with or endorsed by the Aniimo developers or publisher. Game names and trademarks belong to their owners.

Right now it's a closed test between a few friends. Nothing is released yet.

## Why

Between level, stars, Capability Awakening, Potential, personality and Held Items, there's a lot to keep track of for every Aniimo, and it gets messy once you have a few teams. We were doing it in a spreadsheet, so this is the spreadsheet turned into an app.

## Features

- Team tracker: up to 4 teams of 4 Aniimo. Each Aniimo has its level, star stage, Capability Awakening progress, Potential per stat, personality, Held Items and CP.
- Friends: add friends and compare teams and stats side by side.
- Overlay (optional): a small always-on-top window you can move to a second monitor. It's a separate window, it doesn't draw inside the game.
- Later on: how stats grow with each upgrade, based on data players enter.

## How data gets in

You type it in. The app does not:

- read or modify game memory
- inject code or hook the game process
- touch game files
- intercept network traffic
- automate anything in the game or give any in-game advantage

No game art is included or downloaded. If you want an image for an Aniimo, you add it yourself.

If the developers ever offer an official API or an approved way to read a player's own data, that's the only automatic source this project would use.

## Stack

- Desktop: Electron, React, TypeScript
- Backend: Python, FastAPI, PostgreSQL
- Everything runs locally for now

## Plan

1. Manual tracker with accounts, teams and editable Aniimo cards
2. Friend profiles and stat comparison
3. Overlay window with second-monitor support
4. Official API integration, only if the developers approve it

It's free and will stay free: no ads, no paywall, no selling data.

## Contact

Axel ([@AxelMejias](https://github.com/AxelMejias)). If you're part of the Aniimo team and something here goes against your rules, let me know and I'll change it or take it down.

## License

MIT, see [LICENSE](LICENSE).
