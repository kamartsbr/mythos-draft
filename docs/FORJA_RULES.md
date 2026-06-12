# FORJA Rules Reference

This document is the focused reference for FORJA draft behavior that differs from standard MCL behavior. Treat any change to these rules as high risk and keep it in a small PR.

## Quick Draft Modes

### FORJA Group Stage quick draft

- `preset`: `FORJA`
- `tournamentStage`: `GROUP`
- `seriesType`: `BO3`
- `customGameCount`: `3`
- Map pool: `FORJA_MAP_POOL`
- Game 1 map picker: Host / Team A
- Game 2 map picker: Guest / Team B
- Game 3 map picker: `ADMIN` / system random
- Per-map playoff god bans are not automatic here unless some other config explicitly enables them

### FORJA Playoffs quick draft MD3 / BO3

- `preset`: `FORJA`
- `tournamentStage`: `PLAYOFFS_BO3`
- `seriesType`: `BO3`
- `customGameCount`: `3`
- Map pool: `FORJA_PLAYOFFS_MAP_POOL`
- `FORJA_PLAYOFFS_MAP_POOL = FORJA_MAP_POOL + FORJA_PLAYOFFS_EXTRA_MAPS`, deduplicated
- Game 1 map picker: Host / Team A
- Game 2 map picker: Guest / Team B, always
- Game 3 map picker: `ADMIN` / system random
- Each game has 1 god ban per team after map pick and before god picks

### FORJA Playoffs quick draft MD5 / BO5

- `preset`: `FORJA`
- `tournamentStage`: `PLAYOFFS_BO5`
- `seriesType`: `BO5`
- `customGameCount`: `5`
- Map pool: `FORJA_PLAYOFFS_MAP_POOL`
- Game 1 map picker: Host / Team A
- Game 2 map picker: Guest / Team B, always
- Game 3 map picker: loser of Game 2
- Game 4 map picker: loser of Game 3
- Game 5 map picker: `ADMIN` / system random
- Each game has 1 god ban per team after map pick and before god picks

## Critical Distinction From MCL Playoffs

Do not copy MCL Playoffs rules blindly into FORJA Playoffs.

- In FORJA Playoffs, Game 2 is always Guest / Team B map pick
- In FORJA Playoffs, the final map is random/admin/system rolled, not pre-defined
- FORJA Playoffs does not use MCL `playoffsLastMap` behavior

## FORJA Playoffs Extra Maps

`FORJA_PLAYOFFS_EXTRA_MAPS` includes:

- `arena`
- `mirage`
- `silk_road`
- `team_migration`
- `obsidian_ridge`
- `blood_river_crossing`
- `nile_shallows`
- `nomad`
- `erebus`
- `jotunheim`

## Risk Warning

Any future change involving FORJA Playoffs map flow, god bans, map pool, bracket generation, official lobby generation, standings, or Firestore writes must be treated as high risk and kept in a small PR.

Areas that must not be casually coupled together:

- FORJA Group Stage quick draft
- FORJA Playoffs quick draft
- MCL Playoffs
- official bracket generation
- official lobby generation
- standings and playoff seeding
- Firestore write paths
