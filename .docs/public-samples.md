# Public English trial samples

Selected 2026-09-12 from VOA Learning English's **Words and Their Stories**, written by Anna Matteo. These are narration excerpts, not full episodes or newly generated voices.

## Reuse basis

[VOA Learning English: Request Our Content](https://learningenglish.voanews.com/p/6861.html) explicitly permits educational and commercial reuse of its public-domain texts and MP3s with credit to learningenglish.voanews.com. It excludes material from outside news agencies such as AP, Reuters and AFP. The selected lessons carry VOA authorship; no photographs, artwork, logos or news-agency reporting are imported.

Some episodes include commercial songs at the end. In particular, the original Curiosity episode credits The Cure's “Love Cats.” Those sections are excluded. All three extracts start after the show introduction and finish before the closing music. Audio-model review reported no audible music in the chosen intervals; this is supplementary content review, not a rights determination. Permission relies on VOA's published terms and the identified source authorship. This is a lower-risk selection, not a guarantee of universal copyright clearance.

| Trial title | Original page | Original interval | Duration |
|---|---|---|---|
| Color Outside the Lines | [Do You Color Inside or Outside the Lines?](https://learningenglish.voanews.com/a/do-you-color-inside-or-outside-the-lines-/7427555.html) | 02:00.200–03:58.600 | 1:58 |
| Pin Your Hopes on Something | [Be Careful When You 'Pin Your Hopes on Something!'](https://learningenglish.voanews.com/a/be-careful-when-you-pin-your-hopes-on-something-/5745199.html) | 00:33.500–02:51.200 | 2:17 |
| Curiosity, Questions, and Prying | ['Curiosity Killed the Cat'](https://learningenglish.voanews.com/a/curiosity-killed-the-cat-/4567264.html) | 01:23.100–03:36.900 | 2:13 |

The first extract begins with the complete sentence “Many children are taught to color inside the lines.” The automated review called this “mid-sentence” but also transcribed that full sentence and described the boundary as smooth; the timestamped transcription places its onset after the cut. No claim of human listening acceptance is made.

## Preparation and release

The allowlist, original URLs and edit boundaries are in `content/public-samples.json`. Run `node --env-file=.env --import tsx scripts/prepare-public-samples.ts` to prepare audio, timestamped transcripts, acoustic analysis and D1 seed files in ignored `.wrangler/public-samples/`. Preparation uses paid Whisper and audio analysis calls when the respective cache files are absent. Never print or export `.env`.

Transcripts are generated from the original audio, then rebased to the excerpt. Resume anchors follow sentence punctuation with a 25-second maximum grouping target. The retained audio has 26/23/24 transcript segments and 23/23/19 resume anchors, respectively. Source audio, captured HTML, analysis evidence and SQL remain in `.wrangler/public-samples/`; business data is published into D1 and R2.

Release audio SHA-256:

- `voa-color-outside-lines`: `170626ad9bfdb17655fe7d533f60b261ee5767bf90f83c706ea5ab5648cb1a63`
- `voa-pin-your-hopes`: `e25366dbb4e6b7fc4816a8df2fcbec7bbd484cc6c91b8790e9b50e8552dadc28`
- `voa-curiosity-and-prying`: `7750a014d7b0778c75ee7ebd12a71e0edbb4abeb71a384f15f0a798afad0b6ae`

The player displays publisher, author, source and reuse-policy links; sample cards label the content English and excerpted. English locale prefers an English sample for the main CTA. The previous Chinese project demo remains available. No other local podcasts or user history are exported.

## Expanded English library — 2026-09-12

Six additional excerpts were prepared and approved for publication by the user. Existing VOA samples and the Chinese project demo are retained.

| ID | Original interval | Duration | Publisher / reuse basis |
|---|---|---|---|
| eff-oligarchy | 01:32.500–04:46.650 | 3:14 | EFF, *Smashing the Tech Oligarchy*, Cindy Cohn / Jason Kelley / Kara Swisher; episode explicitly CC BY 4.0 |
| eff-enshittification | 03:50.600–05:47.100 | 1:56 | EFF, *Fighting Enshittification*, Cindy Cohn / Jason Kelley / Cory Doctorow; episode explicitly CC BY 4.0 |
| nasa-black-holes | 10:24.450–12:21.150 | 1:56 | NASA Curious Universe, Jacob Pinter / Ronald Gamble; NASA media usage guidelines |
| nasa-martian-food | 07:13.800–10:57.600 | 3:43 | NASA Houston We Have a Podcast, Gary Jordan / Grace Douglas; NASA media usage guidelines |
| foss-blender | 02:39.500–05:12.300 | 2:32 | FOSS and Crafts, Morgan and Christine Lemmer-Webber; published episode page contents under CC BY-SA 4.0 |
| hpr-llm | 02:14.000–04:59.550 | 2:45 | Hacker Public Radio 4064, Daniel Persson; episode explicitly CC BY-SA 4.0 |

Source URLs, source hashes, attribution and license links are recorded in `content/public-samples.json`. EFF license declarations appear in the episode transcripts at https://www.eff.org/deeplinks/2025/07/podcast-episode-smashing-tech-oligarchy and https://www.eff.org/deeplinks/2024/06/podcast-episode-fighting-enshittification . Both mention separately licensed music; the selected speech portions have no music detected. NASA policy: https://www.nasa.gov/nasa-brand-center/images-and-media/ . These are factual listening excerpts, not endorsements; no NASA logo, guest photo or third-party artwork is used. NASA's general policy does not clear third-party material, so music-bearing montage sections were excluded. FOSS and Crafts episode/license: https://fossandcrafts.org/episodes/062-blender.html . HPR episode/license: https://hackerpublicradio.org/eps/hpr4064/index.html .

The CC excerpts and accompanying adapted transcripts are distributed under their stated source licenses, including ShareAlike for FOSS and HPR. Player links provide downloadable excerpts and JSON transcripts without a paywall or DRM. Attribution identifies source speakers and publisher, links to the original episode, labels the modification as an excerpt, and links to the applicable license. The general application code license does not replace these media licenses. HPR's episode is a February 2024 perspective, not a claim about current model capabilities; NASA's food interview was recorded in 2020 and republished in 2023.

All six audio-model reviews reported `musicAudible: false`. Black-hole review described the opening as mid-sentence but quoted the full introductory question, beginning “Maybe this is a weird question”; the cut precedes that question's timestamp. The original audio, captured source pages, timestamped transcripts, review responses and hashes are in ignored `.wrangler/public-samples/`. This is automated acoustic review, not a claim of human listening acceptance. EFF oligarchy's original model JSON contained subtraction expressions for durations; those numeric fields were normalized without executing model text, and the raw response is retained.

Preparation now accepts only the explicit publisher audio host allowlist and checks each original against its reviewed SHA-256. `SAMPLE_IDS` limits preparation to selected IDs. Optional transcription windows avoid sending whole hour-long episodes to the transcription provider; `TRANSCRIBE_ONLY=1` prepares timestamps before edit-boundary selection. When changing a transcription window, archive its old transcript cache before rebuilding. Original source IDs and excerpt IDs must remain distinct.

Validation: production build and two browser tests passed, including playback and transcripts for all nine English excerpts, English CTA selection, CC download links, and desktop viewport containment. Prepared data verification checks transcript timing bounds, nonempty anchors and matching review/audio hashes. Release manifest: `.wrangler/public-samples/expanded-release.json`.
