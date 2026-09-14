-- Retires the nine English samples published on 2026-09-12.
-- Apply with:
--   npx wrangler d1 execute asidefm --remote --config wrangler.production.jsonc \
--     --file=content/retire-public-samples.sql
-- Each episode also has exactly one R2 object that this file cannot remove:
--   npx wrangler r2 object delete asidefm-audio/episodes/<id>/original \
--     --remote --config wrangler.production.jsonc

-- nasa-martian-food
DELETE FROM artifacts WHERE key LIKE 'episodes/nasa-martian-food/%';
DELETE FROM checkpoints WHERE episode_id='nasa-martian-food';
DELETE FROM voice_usage WHERE episode_id='nasa-martian-food';
DELETE FROM episodes WHERE id='nasa-martian-food';

-- nasa-black-holes
DELETE FROM artifacts WHERE key LIKE 'episodes/nasa-black-holes/%';
DELETE FROM checkpoints WHERE episode_id='nasa-black-holes';
DELETE FROM voice_usage WHERE episode_id='nasa-black-holes';
DELETE FROM episodes WHERE id='nasa-black-holes';

-- foss-blender
DELETE FROM artifacts WHERE key LIKE 'episodes/foss-blender/%';
DELETE FROM checkpoints WHERE episode_id='foss-blender';
DELETE FROM voice_usage WHERE episode_id='foss-blender';
DELETE FROM episodes WHERE id='foss-blender';

-- eff-enshittification
DELETE FROM artifacts WHERE key LIKE 'episodes/eff-enshittification/%';
DELETE FROM checkpoints WHERE episode_id='eff-enshittification';
DELETE FROM voice_usage WHERE episode_id='eff-enshittification';
DELETE FROM episodes WHERE id='eff-enshittification';

-- eff-oligarchy
DELETE FROM artifacts WHERE key LIKE 'episodes/eff-oligarchy/%';
DELETE FROM checkpoints WHERE episode_id='eff-oligarchy';
DELETE FROM voice_usage WHERE episode_id='eff-oligarchy';
DELETE FROM episodes WHERE id='eff-oligarchy';

-- hpr-llm
DELETE FROM artifacts WHERE key LIKE 'episodes/hpr-llm/%';
DELETE FROM checkpoints WHERE episode_id='hpr-llm';
DELETE FROM voice_usage WHERE episode_id='hpr-llm';
DELETE FROM episodes WHERE id='hpr-llm';

-- voa-curiosity-and-prying
DELETE FROM artifacts WHERE key LIKE 'episodes/voa-curiosity-and-prying/%';
DELETE FROM checkpoints WHERE episode_id='voa-curiosity-and-prying';
DELETE FROM voice_usage WHERE episode_id='voa-curiosity-and-prying';
DELETE FROM episodes WHERE id='voa-curiosity-and-prying';

-- voa-pin-your-hopes
DELETE FROM artifacts WHERE key LIKE 'episodes/voa-pin-your-hopes/%';
DELETE FROM checkpoints WHERE episode_id='voa-pin-your-hopes';
DELETE FROM voice_usage WHERE episode_id='voa-pin-your-hopes';
DELETE FROM episodes WHERE id='voa-pin-your-hopes';

-- voa-color-outside-lines
DELETE FROM artifacts WHERE key LIKE 'episodes/voa-color-outside-lines/%';
DELETE FROM checkpoints WHERE episode_id='voa-color-outside-lines';
DELETE FROM voice_usage WHERE episode_id='voa-color-outside-lines';
DELETE FROM episodes WHERE id='voa-color-outside-lines';
