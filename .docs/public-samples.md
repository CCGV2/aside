# Public samples

The public library holds six historical recordings. All six are U.S. government works and carry no copyright in the United States (17 U.S.C. §105): the recordings were made by federal agencies or by a private company that conveyed its rights to the government, and the masters are held by the National Archives.

| ID                        | Title                                   | Publisher                                       | Source                                                                 | Excerpt             | Duration |
| ------------------------- | --------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- | ------------------- | -------- |
| `jfk-rice-moon`           | We Choose to Go to the Moon             | John F. Kennedy Presidential Library and Museum | [archive.org `jfks19620912`](https://archive.org/details/jfks19620912) | 08:14.120–12:02.180 | 3:48     |
| `reagan-brandenburg-gate` | Tear Down This Wall                     | Ronald Reagan Presidential Library and Museum   | [NARA 7087579](https://catalog.archives.gov/id/7087579)                | 30:24.820–32:38.000 | 2:13     |
| `chronoscope-kennedy`     | John F. Kennedy on the 1952 Senate Race | NARA · Longines Chronoscope                     | [NARA 95777](https://catalog.archives.gov/id/95777)                    | 00:35.040–04:09.680 | 3:35     |
| `chronoscope-warren`      | Earl Warren Runs for President          | NARA · Longines Chronoscope                     | [NARA 95746](https://catalog.archives.gov/id/95746)                    | 01:34.720–04:57.580 | 3:23     |
| `chronoscope-moses`       | Robert Moses on Urban Renewal           | NARA · Longines Chronoscope                     | [NARA 95822](https://catalog.archives.gov/id/95822)                    | 00:59.800–04:05.540 | 3:06     |
| `chronoscope-byrd`        | Richard E. Byrd, Explorer               | NARA · Longines Chronoscope                     | [NARA 95934](https://catalog.archives.gov/id/95934)                    | 01:24.990–04:17.710 | 2:53     |

`jfk-rice-moon` is President Kennedy's address on the space effort at Rice University Stadium, Houston, September 12, 1962. The excerpt runs from "Its conquest deserves the best of all mankind" through "and in this decade we shall make up and move ahead", and contains the "We choose to go to the moon in this decade… not because they are easy, but because they are hard" passage.

`reagan-brandenburg-gate` is President Reagan's address to the citizens of Berlin at the Brandenburg Gate, June 12, 1987, from the White House Communications Agency tape PP7163C. The excerpt runs from "And now, now the Soviets themselves may in a limited way be coming to understand the importance of freedom" through "Mr. Gorbachev, tear down this wall" and the applause that follows. The NARA item also contains remarks by Chancellor Helmut Kohl; the excerpt excludes them.

The four `chronoscope-*` entries are episodes of _Longines Chronoscope_, a 15-minute interview programme carried on CBS-affiliated stations from 1951 to 1955, hosted by William Bradford Huie with a rotating co-editor. Each excerpt is one continuous stretch of the interview.

## Language

Each spec carries two language fields. `language` is the language the recording is spoken in. `languageVisibility` lists the interface languages the recording is published on — `["en", "zh-cn"]` puts it on both the English and the Chinese page, `["en"]` on the English page only. All six current entries are `["en", "zh-cn"]`, so nothing disappears from either page today; publishing a recording on one page only is now a one-line data edit.

`frontend/src/library-item.ts` turns that into a page: `libraryFor` keeps the recordings whose visibility covers the interface language, then `byLocale` lists recordings in that language first. The remaining ones keep their arrival order and carry a language badge (`languageBadge`) naming the recording's language. A recording **without** `languageVisibility` is never filtered out, only ordered — that field is written for the curated library, and a listener's own uploads must not vanish from their own player. Visibility entries and `language` are both compared on the primary subtag, so `zh-cn` and `zh-Hans` count as `zh`.

Nothing in the preparation path is English-only. Each spec carries `language`, and `scripts/prepare-public-samples.ts` uses it for three things: the published `attribution.language`, the language the audio-analysis prompt asks its summary and hostStyle in, and the language name used in that prompt. Resume grouping lives in `scripts/sentence-groups.ts` and splits on full-width `。！？…` as well as Latin `.!?`, plus a trailing closing mark, so Chinese transcripts anchor on sentences instead of falling through to the 25-second cap. `tests/sentence-groups.test.ts` covers both scripts, the cap and the closing-mark rule.

The library still holds no Chinese sample, so adding one is now only a matter of adding a spec entry — no code change. LibriVox's Chinese recordings on archive.org (`language: zho`, public-domain dedication) are the likely source: `liaozhai_zhiyi_0906_librivox-1` and `lun_yu_0801_librivox` have 4–8 minute chapter files that fit the excerpt limit, while `300_tang_poems_vol_1_librivox` is one ~70-second poem per file and would need the pipeline to concatenate several files before it can be used.

## Reuse basis

Recordings made by U.S. government agencies in the course of their duties are not subject to copyright. The Kennedy address is a NARA holding digitized by the Miller Center's Scripps Library; the Reagan address is the National Archives' own transfer of the WHCA tape.

The Chronoscope episodes rest on a conveyance, not on §105 alone. Longines-Wittnauer, the watch company that sponsored the programme and owned its copyright, donated the collection to the National Archives and **conveyed all rights to the U.S. Government on December 19, 1969**. NARA records that on each item:

```
useRestriction: { "note": "Longines-Wittnauer Watch Co., Inc. conveyed all
                  rights to the U.S. Government on December 19, 1969.",
                  "status": "Unrestricted" }
```

NARA published these transfers itself: 231 episodes are in its `usgovfilms` collection on archive.org with `CC0`, and the audio used here is the `_512kb.mp4` derivative of each item. The National Archives also publishes a [catalogue of the Chronoscope interviews](https://www.archives.gov/research/guides/catalog-tv-interviews-1951-to-1955.html).

This is deliberately narrower than the general rule for sound recordings. The Library of Congress describes the schedule applied to commercially published recordings: those first published before 1923 are in the public domain, those published 1923–1946 are protected for 100 years, 1947–1956 for 110 years, and all others made before February 15, 1972 are protected until February 15, 2067 ([LoC, "How does Copyright work for sound recordings"](https://ask.loc.gov/recorded-sound/faq/313179)). That schedule excludes most twentieth-century broadcast and commercial speech recordings, which is why the library is limited to government recordings and government-conveyed material.

An archive.org licence tag is not evidence by itself. `jfks19620912` carries no licence field at all. Some 1957–58 _Mike Wallace Interview_ episodes on archive.org are tagged `publicdomain` by their uploaders, but the Harry Ransom Center — which holds them — states that copyright is held by Mike Wallace and that "any further use of this material requires the permission of both Mike Wallace and the Ransom Center". Both kinds of entry are accepted only on the provenance chain above, and the source SHA-256 in `content/public-samples.json` pins the exact bytes that were reviewed.

## Preparation

`content/public-samples.json` is the allowlist and edit specification. `scripts/prepare-public-samples.ts` downloads each `audioUrl`, checks its SHA-256, transcribes, cuts the excerpt, has the audio model review it, and writes the excerpt mp3, episode JSON and D1 seed SQL into ignored `.wrangler/public-samples/`. Preparation uses paid transcription and audio-analysis calls when the cache files are absent.

```sh
node --env-file=.env --import tsx scripts/prepare-public-samples.ts
```

`SAMPLE_IDS=jfk-rice-moon` limits a run to one entry. `TRANSCRIBE_ONLY=1` prepares and caches transcripts before an excerpt is chosen, which is how the windows above were picked; transcripts are cached per `sourceId`, so archive the old cache before changing a transcription window.

Four things need attention with this material:

- **Every Chronoscope episode carries advertising.** The Longines billboard runs at the top of the Warren, Moses and Byrd episodes, and a Longines spot plus network credits close all four. The excerpts sit between them (content ends around 10:50–12:01 depending on the episode) and must not be extended into either end.
- **Long sources need a narrower transcription window.** The Reagan source is 46:30 and times out as one request, so its window is narrowed to 28:20–33:20. The Chronoscope episodes are 13:30–14:40 and transcribe in one request. Locating a passage in a long file in the first place needed a one-off chunked pass, because the committed script deliberately only ever sends one request per source.
- **The audio is a video file.** The Chronoscope sources are archive.org's `_512kb.mp4` derivatives, about 59–67 MB each; the `.mpeg` originals are 650–715 MB and are not used. No code change is needed — ffmpeg writing to `.mp3` selects the audio stream on its own, and the excerpt step already passes `-map 0:a:0`.
- **Whisper segments do not line up with sentence boundaries**, and the excerpt filter keeps only whole passages. A window that ends inside a passage chops the audio mid-sentence while the transcript stops earlier. The windows above were chosen so the first and last retained passage begin and end a sentence; re-check any window change with the `audioReview` field rather than by duration alone.

`scripts/sample-spec.ts` holds the spec contract and validates each entry before anything is downloaded or sent to a paid provider. It accepts only `archive.org` and `catalog.archives.gov` as audio hosts, and it requires `title`, `publisher`, `author`, `sourceUrl`, `license`, `licenseUrl`, `summary` and `sourceSha256` on every entry. There are no attribution fallbacks: a spec that omits a credit fails the run instead of publishing under a default publisher, author or licence.

## Transcription quality

These are 1940s–1980s transfers and the transcripts are noticeably rougher than the podcast excerpts the library used to hold. Known, accepted errors, all visible to listeners in the player:

- `chronoscope-kennedy`: "Senator Lodge" is rendered "senator large" and "senator lange" throughout, and "Henry Cabot Lodge" as "henry cabot live".
- `chronoscope-warren`, `chronoscope-moses`, `chronoscope-byrd`: "Longines" becomes "launching" or "long gene", and the host's name "Frank Knight" becomes "frank night".
- `jfk-rice-moon`: occasional dropped words; `reagan-brandenburg-gate`: "comity" is rendered "comedy".

Transcripts are generated from the audio and are not hand-corrected, so a re-run reproduces the same errors. Correcting them would need a deliberate correction step in the pipeline rather than an edit to a cached file.

## Source and excerpt hashes

Source audio SHA-256 (the exact bytes reviewed):

- `jfks19620912`: `0e3c2a036cb3b605209657b26e529a0b35833ad34f07cf5e814c839bf2ab9a8b`
- `reagan-pp7163c`: `55b01136cd030d97fdd8aa79a14d3d733a24ced2396b84691015f02e33e80fe0`
- `chronoscope-95777`: `dca07f9d7ec7ef3a7a8fea0b63b2f2e3061178f67deae091866611c6e4e596b2`
- `chronoscope-95746`: `8b84595009c770f4b44e365e375e114b531826cc7cf3228bc4cb425afdc6798a`
- `chronoscope-95822`: `0e12cd92dbe0ee1e5761ebf3fe2c32bb095a1fd8b88d7527524a5fce1ba234be`
- `chronoscope-95934`: `093dbc5f3551f6fb4e2eb330a4447fc4c466db7be2e497fa9f8e2f092eb566d5`

Published excerpt SHA-256:

- `jfk-rice-moon`: `dafd281c2e35f8b158401c71bbe8f4bf59039a18a85986c747014274f5f21473`
- `reagan-brandenburg-gate`: `34b405fcc6e579e87203bfb5f67fbb62ac180cafc1a8f942e86b34c969f6d86c`
- `chronoscope-kennedy`: `d3cbc7953269e0845370fb8edbf9237e154ffd13e796ae0f2c334e708b3d5326`
- `chronoscope-warren`: `020b0ab38bb2634c6640662a027bc9b059437c32d6afc5f1399caa81c49f10a2`
- `chronoscope-moses`: `ae95ae092826d563d06c3e38aedbf017b883577bbf449cbda038673b5f20759b`
- `chronoscope-byrd`: `08d5ef5a3a601370ffc66ac1c6f52f9349f52c49bdfce39088c066c4fc7b2bd9`

Audio-model review reported `musicAudible: false` for all six. It described every cut as clean except `chronoscope-byrd`, whose opening it called "slightly abrupt" — the excerpt starts on the host's question "and Admiral Byrd, you've been to both the North Pole and the South Pole", which is a turn boundary but not a paragraph opening. That is automated acoustic review, not human listening acceptance.

## Retired library

Nine English podcast samples were published on 2026-09-12 and are withdrawn: three VOA Learning English lessons (`voa-color-outside-lines`, `voa-pin-your-hopes`, `voa-curiosity-and-prying`), two EFF episodes (`eff-oligarchy`, `eff-enshittification`), two NASA podcast excerpts (`nasa-black-holes`, `nasa-martian-food`), FOSS and Crafts (`foss-blender`) and Hacker Public Radio (`hpr-llm`).

Withdrawing them needs both stores. Deleting the D1 rows is what revokes access: `/api/episodes/:id/audio` resolves the episode row before it touches R2, so a removed row returns 404 even while its object is still in the bucket. The R2 objects still have to go, or they linger as unreachable bytes.

Delete the R2 objects first, while the row list is still intact and the keys are known:

```sh
for id in voa-color-outside-lines voa-pin-your-hopes voa-curiosity-and-prying \
          eff-oligarchy eff-enshittification nasa-black-holes nasa-martian-food \
          foss-blender hpr-llm; do
  npx wrangler r2 object delete "asidefm-audio/episodes/$id/original" \
    --remote --config wrangler.production.jsonc
done
```

Then remove the D1 rows with `content/retire-public-samples.sql`. Each retired episode's seed SQL and excerpt mp3 are still in this machine's `.wrangler/public-samples/` (ignored by git), so this machine can restore them as they were; if that directory is lost they can be rebuilt from the previous `content/public-samples.json` in git history, at the cost of a fresh paid transcription run.

## Release

Preparation writes `.wrangler/public-samples/<id>.mp3`, `<id>.json` and `<id>.sql`. Publishing needs production credentials and is not covered by the repository test suite. `wrangler.production.jsonc` pins `account_id`, so these commands do not depend on which account a fresh OAuth login defaults to.

```sh
# 1a. Delete the retired R2 objects (loop in "Retired library" above).
# 1b. Remove the retired D1 rows.
npx wrangler d1 execute asidefm --remote --config wrangler.production.jsonc --file=content/retire-public-samples.sql

# 2. Upload the excerpts.
for id in jfk-rice-moon reagan-brandenburg-gate chronoscope-kennedy \
          chronoscope-warren chronoscope-moses chronoscope-byrd; do
  npx wrangler r2 object put "asidefm-audio/episodes/$id/original" \
    --file=".wrangler/public-samples/$id.mp3" --content-type audio/mpeg \
    --remote --config wrangler.production.jsonc
done

# 3. Import metadata, transcripts and resume anchors.
for id in jfk-rice-moon reagan-brandenburg-gate chronoscope-kennedy \
          chronoscope-warren chronoscope-moses chronoscope-byrd; do
  npx wrangler d1 execute asidefm --remote --config wrangler.production.jsonc \
    --file=".wrangler/public-samples/$id.sql"
done
```

Verify `GET https://asidefm.com/api/episodes` returns exactly the six entries with `ready` status, that `GET https://asidefm.com/api/episodes/<retired-id>/audio` returns 404 for each of the nine retired ids, that each excerpt's full-file SHA-256 matches the table above, and that `Range: bytes=0-1023` returns 206. `tests/browser/public-samples.spec.ts` covers the player, transcript and download links for all six, but it needs an environment that serves them.
