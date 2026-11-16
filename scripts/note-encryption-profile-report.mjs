import assert from 'node:assert/strict'
import {readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

const directory = process.argv[2]
assert.ok(
  directory,
  'Pass the NOTE_ENCRYPTION_PROFILE_DIR from a completed run.',
)
const result = JSON.parse(
  await readFile(join(directory, 'result.json'), 'utf8'),
)
const {traceEvents} = JSON.parse(
  await readFile(join(directory, 'renderer-trace.json'), 'utf8'),
)
assert.equal(result.provenance.dataLossOccurred, false, 'Trace lost events')
const attribution = {}
for (const name of ['encrypted32KiB', 'ordinary32KiB']) {
  const measurement = result[name]
  const mark = traceEvents.find(
    (event) => event.name === `profile-start-${name}`,
  )
  assert.ok(mark, `Missing renderer time anchor for ${name}`)
  const lane = traceEvents.filter(
    (event) => event.pid === mark.pid && event.tid === mark.tid,
  )
  const relative = (time) => mark.ts + (time - measurement.start) * 1000
  const from = relative(measurement.start)
  const to = relative(measurement.end)
  // Include a task crossing a measurement boundary, not only tasks starting in it.
  const tasks = lane
    .filter(
      (event) =>
        event.name === 'RunTask' &&
        event.ph === 'X' &&
        event.dur >= 40_000 &&
        event.ts < to &&
        event.ts + event.dur > from,
    )
    .map((task) => {
      const edit = measurement.replacements.find(
        (replacement) =>
          task.ts < relative(replacement.commit) &&
          task.ts + task.dur > relative(replacement.start),
      )
      return {
        durationMs: task.dur / 1000,
        afterStartMs: (task.ts - from) / 1000,
        replacementIndex: edit?.index ?? null,
        nestedEvents: lane
          .filter(
            (event) =>
              event.ph === 'X' &&
              event.ts >= task.ts &&
              event.ts + event.dur <= task.ts + task.dur &&
              event.dur >= 1000 &&
              event !== task,
          )
          .sort((a, b) => b.dur - a.dur)
          .slice(0, 30)
          .map((event) => ({
            name: event.name,
            durationMs: event.dur / 1000,
            type: event.args?.data?.type,
            functionName: event.args?.data?.functionName,
            url: event.args?.data?.url,
            lineNumber: event.args?.data?.lineNumber,
          })),
      }
    })
  attribution[name] = {
    observerLongTasks: measurement.tasks,
    rendererTasksAtLeast40Ms: tasks,
    caveat:
      'Nested durations overlap; do not sum them. CPU sampling adds overhead.',
  }
}
await writeFile(
  join(directory, 'attribution.json'),
  JSON.stringify(attribution, null, 2) + '\n',
)
console.log(JSON.stringify(attribution, null, 2))
