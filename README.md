# Comic Frontier Interactive Map Tools

This is a repository to help process the data that is used in the CF Interactive Map pipeline. Right now, this is still a manual process, but is planned to be the backbone of the future API (though right now not even module exports are set up)

## The state of the code

Right now the code is haphazardly placed together and has hideous nestings, but the output data structure should be more understandable as those nestings has been cut off than how it was first structured.

The code strictly follows the typing rules in `./src/lib/types` for both input and output data, but in the process may made a temporary form of data.

This code assumes some rules:
- the fandom string in the raw data follows a structure in which the fandom substrings are separated by comma, so each string in a comma will be treated as ONE FANDOM. i.e there are three fandoms in this string: `genshin impact, identity v, kpop (suju, bts, nct, exo)`,
- if there are parentheses following the a single fandom substring, the substring before the parentheses will be considered the parent (the superset) of whatever is insde of the parentheses (the subsets), while the substring in the parentheses will be further processed like a normal full fandom string. i.e in the substring `kpop (suju, bts, nct, exo)`, `kpop` will be the superset, while all four subset fandoms `suju`, `bts`, `nct`, and `exo` will be its own fandoms assuming `kpop` as it superset.

Side effects from those known assumptions:
- fandom substring that was beginning directly with a parentheses or have incomplete parentheses will be considered a whole fandom. Good luck whoever circle that sells `(anikara)`, `(g`, `Shrek (oh Y Itu Ntar Shrek Gantengnya Jadi Fr`.
- fandom string that are not separated by comma will be considered one fandom like `Identity V Genshin Impact Honkai Star Rail` or `Nct - Jjk`, such a collaboration gembrot if you ask me. This is the sole reason the web CF map has the feature to search by substring so all fandoms with matching substrings appeared/suggested in the search result, and the addition of "Mark All Suggested" feature,
- While it's normal for a fandom to have more than one children/subsets, fandoms may also have more than one parents/supersets. i.e `Genshin Impact` may be attributed with officially curated superset like `Hoyoverse` and ones that defined by the circles themselves like `Games`. However, if someone write another superset, like `Hoyoverse Games`, then Genshin Impact will now have three supersets. As per CF18, it has five supersets, other than the three that mentioned above, those are `Gaming` and `Rpg Game`.

Other observed phenomenons yet to be resolved:
- Some fandoms that are the exact same but are not curated may result in two or more fandoms in the output data. For example, `Identity V` and `idv` are both the same but still considered different. Assuming one abbreviation to one fandom is risky because of how wild the abbreviations and shorthands can be, like `proseka` and `pjsk` are all the same with `Project Sekai`, which is also the shorthand of the official name `HATSUNE MIKU: COLORFUL STAGE!`.
- Tuning out levenshtein requirements in the config may be confusing sometimes since some fandoms may have less than the minimum letter count you set, and will result as different fandoms instead of one fandom with common typo. This happens to `Identity V` and `IdentityV` with the letter min count settings set to `12` in the config. However, if you tone it down to `8` and even more prevalent if less than that, sometimes the fandoms that are definitely different fandom are associated to one another.
- It's not understood why a fandom substring that matched the name of already existing fandom visually may not be considered a match. I suspected that this may be the string matching logic problem. Initially this problem arose from the `===` operator that does not match everything. So I resorted to even more rigorous checking with turning them into a `JSON.stringify()` result and compare, that eliminates some of the cases but not all of them. Per CF18, there are 13 different fandoms with exact same name and code, verbatim: `Sousou No Frieren`, and another 20 others. The levenshtein comparison may also contribute to the problem.

tl;dr: LU BAKAL SAKIT KEPALA :3

## Set up and running

### Preparing up data and setting config

There are few things that you might want to modify before running.

First off, you need to prepare your data in `./res/raw/<yourdataname>.json` or anywhere you liked as long as the line where the data input in `./src/index.ts` is changed appropriately. As of this commit, it was set to run `src/res/raw/cf18_catalog_raw_20240429_uuidfix.json`.

Also, the catalog processor has some config defined as type `FindFandomConfig` in `index.ts`. This config will determine how the search is held and how strict it will be by defining the [levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance) to match how close a typo can be considered "the same" with its intended fandom, the string length minimum requirement to be processed using levenshtein, and also whether regex search is also exercised.

Last but not least, you might want to check the data seed in `./src/res/seed/fandomStatesSeed.json`. This contains all the fandoms that you want to curate manually, so when the data is being processed, if the code finds a matching fandom, it will attach its UUID to related fields in the output data. Fandoms that are not mentioned in this seed will be generated on process. All the fandoms declared in the seed will be marked as "official/curated" (the `curatedCFIM` or `curatedFDCT` flag is `true`).

If you haven't changed anything, by the default the code will output the data in `./out/`.

If you want to put temporary files in the folder outside of its normal structure, don't forget to gitignore it or just put them in `./__DUMP/` folder.

### Dependencies

Install dependencies on project root directory where `package.json` file located.
```bash
npm i
```

### Development environment

After all deps installed, run the NPM script (also defined in `package.json`):
```bash
npm run dev
```

that will run a daemon that in turn will run `./src/index.ts` which currently in turn will run a script written in `./src/script/convertCFCatalogRaw.ts` in TypeScript mode constantly and reruns automatically on a file change. Take note it runs immediately whatever you type on `index.ts` or other files every save, so you might want to modify it a small bit to your liking before running.

## Things to take note

- Amongst all of the UUID in the output data, only Circle UUID is set from the raw data (it means the panitia CF sets it for them), the rest of UUIDs are generated here ad hoc.
- If you took the data right from the web catalog, especially for CF18 you should notice that there are three circles that have zeroed UUIDS (`00000000-0000-0000-0000-000000000000`, which means you can search for it using <kbd>ctrl</kbd> + <kbd>f</kbd>). In this case, you can just go create a new UUID for them, but this time you still have to manually edit the JSON using the UUID package with ```npx uuid```

## Future plans

- A data explorer and editor UI needs to be made since there are currently no data explorer UI for the output data other than the Interactive Map. You might have to go <kbd>ctrl</kbd>+<kbd>f</kbd> with the UUID all over again.
- This will be the backbone of future API.

## Contributing

For the time being, contribution is only open to members of the CF Interactive Map development team and the Fandom Data Collection Team.

If you want to make a change, simply just make another branch and then pull request. Depending on your permissions, I might allow for self-accepting your own pull request.

\- maufirf