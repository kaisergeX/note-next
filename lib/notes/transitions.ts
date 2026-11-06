import {addTransitionType, startTransition} from 'react'

const pending = new Map<object, () => void>()
const dialogs = new Set<HTMLDialogElement>()
let observer: MutationObserver | undefined
let settling = false

function run(update: () => void) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update()
    return
  }
  startTransition(() => {
    addTransitionType('note-list')
    update()
  })
}

function stopObserving() {
  observer?.disconnect()
  observer = undefined
  dialogs.clear()
}

async function flush() {
  if (settling || !pending.size) return
  const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
  open.forEach((dialog) => dialogs.add(dialog))
  if (open.length) return

  settling = true
  await Promise.allSettled(
    [...dialogs].flatMap((dialog) =>
      dialog.getAnimations().map((animation) => animation.finished),
    ),
  )
  settling = false
  if (document.querySelector('dialog[open]')) {
    void flush()
    return
  }

  const updates = [...pending.values()]
  pending.clear()
  stopObserving()
  if (updates.length) run(() => updates.forEach((update) => update()))
}

export function startNoteListTransition(update: () => void, key: object) {
  if (!observer && !document.querySelector('dialog[open]')) {
    run(update)
    return
  }

  // Keep only the latest snapshot for each source while a dialog covers the list.
  pending.set(key, update)
  if (!observer) {
    observer = new MutationObserver(() => void flush())
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['open'],
    })
  }
  void flush()
}

export function cancelNoteListTransition(key: object) {
  pending.delete(key)
  if (!pending.size) stopObserving()
}
