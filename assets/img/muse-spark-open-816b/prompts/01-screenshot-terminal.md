# Terminal screenshot spec — HF metadata + byte sum + PR merge

Real commands and real output, captured 2026-10-17 22:05–22:16 CST:

1. `date -u` → `2026-10-17T14:16:27Z`
2. `curl -s https://hf-mirror.com/api/models/meta-models/Muse-Spark-Open-816B-A42B | jq '{lastModified,downloads,likes,gated,license:.cardData.license_name}'`
   → lastModified 2026-10-15T15:46:43.000Z, downloads 815, likes 456, gated "manual", license "other".
3. `jq '[.[] | select(.path|test("safetensors$")) | .size] | {n:length, bytes:add, gib:(add/1073741824), tb:(add/1000000000000)}' /tmp/hf-tree.json`
   → n 65, bytes 1644333393864, gib 1531.4048098996282, tb 1.644333393864.
4. `gh api repos/huggingface/transformers/pulls/49644 --jq '{title,created_at,merged_at}'`
   → Add Muse Spark Open, 2026-10-15T17:18:03Z, 2026-10-15T17:35:26Z.

Render as a dark terminal at 1000px wide, monospace ≥14px, light text on deep ink background, keep the command text and raw output; no tokens, keys, cookies, or emails. Include a header line with the source and capture time.
