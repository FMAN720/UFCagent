# Parser fixtures

These are reduced, static parser inputs derived from public UFC and ESPN data.
They are intentionally historical test samples, not current rankings or schedules.

- `rankings.html`: ranking tables only, including Media / Meta and P4P structure.
- `brathlete.html`: athlete heading and technical-statistic groups only.
- `athlete.json`: fields used by the athlete/history parser.
- `search2.json`: fields used by MMA sport filtering and athlete identification.
- `eventsrange.json`: schedule and bout fields used by the event parser.

Scripts, page styling, embeds, unrelated HTML attributes, and unrelated search
metadata have been removed from the public fixtures. Links and public sports
records remain to exercise the parser behavior.

Sources: [UFC rankings](https://www.ufc.com.br/rankings),
[Zhang Weili technical page](https://www.ufc.com.br/athlete/zhang-weili), and
[ESPN MMA](https://www.espn.com/mma/). See `THIRD_PARTY_NOTICES.md` at the repository root.
