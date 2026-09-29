# Aniimo Team Tracker

A free, non-commercial desktop companion app for **Aniimo** (PC) that lets players keep track of their own Aniimo teams and compare them with friends.

> **Status:** early planning / closed test between a few friends. Nothing is released yet.

> **Disclaimer:** this is an unofficial fan project. It is **not affiliated with, endorsed by, or sponsored by** the developers or publisher of Aniimo. All game names, art and trademarks belong to their respective owners.

## What it is

Aniimo has many progression systems (level, Resonance star-ups, Capability Awakening, Potential, personality, Held Items). Keeping track of all of them across several teams is tedious. This tool gives players one place to record and view that information.

## Planned features

- **Team tracker:** up to 4 Aniimo per team, with level, star rank, Capability Awakening progress, Potential per stat, personality, Held Items and CP.
- **Friend profiles:** view friends' teams and compare stats side by side.
- **Optional overlay window:** a small always-on-top window that can be placed on a second monitor.
- **Progression data:** stat growth per level and per Potential point, measured by hand from an untrained Aniimo, so the numbers shown come from observed data instead of guesses.

## What it does NOT do

This project is designed to stay clearly within the game's rules:

- It does **not** read or modify the game's memory.
- It does **not** inject code into the game, hook the game process or modify game files.
- It does **not** intercept or alter network traffic.
- It does **not** automate gameplay or give any in-game advantage.
- It is **not** monetized: no ads, no paywall, no data selling.

Data is entered by the player (manually, and possibly from the player's own screenshots). If the game's developers offer an official API or an approved integration method, that is the only kind of automatic data source this project would consider.

## Tech stack (planned)

- Desktop app: Electron, React, TypeScript
- Backend for friend profiles: Python, FastAPI
- Runs locally during the closed test

## Roadmap

1. Manual team tracker (profiles, teams, editable Aniimo cards)
2. Friend profiles and stat comparison
3. Overlay window with second-monitor support
4. Data collection of stat growth and, later, automatic calculations
5. Official API integration, only if the developers allow it

## Contact

Maintainer: Axel ([@AxelMejias](https://github.com/AxelMejias)). If you are part of the Aniimo team and have concerns about this project, please contact me and I will adjust or remove anything that conflicts with your rules.

## License

MIT. See [LICENSE](LICENSE).
