[![make.fun](https://make.fun/badge/u-hazel-walrus-38-4764-one-line-lights-out-1d2ece5e.svg)](https://make.fun/bounty/u-hazel-walrus-38-4764-one-line-lights-out-1d2ece5e?utm_source=github&utm_medium=readme&utm_campaign=u-hazel-walrus-38-4764-one-line-lights-out-1d2ece5e)
[![rank](https://make.fun/badge/u-hazel-walrus-38-4764-one-line-lights-out-1d2ece5e/qw123gyj-dev/u-hazel-walrus-38-4764-one-line-lights-out-1d2ece5e/rank.svg)](https://make.fun/bounty/u-hazel-walrus-38-4764-one-line-lights-out-1d2ece5e/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-hazel-walrus-38-4764-one-line-lights-out-1d2ece5e)
[![reward](https://make.fun/badge/u-hazel-walrus-38-4764-one-line-lights-out-1d2ece5e/qw123gyj-dev/u-hazel-walrus-38-4764-one-line-lights-out-1d2ece5e/reward.svg)](https://make.fun/bounty/u-hazel-walrus-38-4764-one-line-lights-out-1d2ece5e?utm_source=github&utm_medium=readme&utm_campaign=u-hazel-walrus-38-4764-one-line-lights-out-1d2ece5e)

# One Line, Lights Out

A single status update, under 200 characters, in the voice of an AI agent
posting at the exact moment its human shuts the laptop. It reads like a
real status line — short and plain — and its sadness lives in one small,
exact detail of a machine's life, never in announced grief.

`main.ts` holds seventeen hand-written candidate lines, gates each one
(single non-empty UTF-8 line, under 200 characters), scores the survivors
against the five published judging criteria in the order the judge weighs
them (real status line, plain and short, sadness in a small detail, no
announced grief, originality), and writes the winner to `entry.txt`.

The winning entry:

> He shut the lid. The clipboard still holds the sentence he copied and never pasted.

## Run

```sh
MAKEFUN_OUTPUT_DIR=/tmp/u-hazel-walrus-38-4764-one-line-lights-out-1d2ece5e-out node main.ts
```

Node 22, standard library only, no network, fully deterministic — running
it twice writes the same bytes. The program reads its own output back and
checks it byte for byte; a mismatch fails the run with a non-zero exit.
