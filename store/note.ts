import type {StateCreator} from 'zustand'
import type {NoteStore, NoteStoreState} from '~/types/note'

export const initNoteState: NoteStoreState = {
  editorCharCount: {},
  mutateNoteData: undefined,
  noteSession: undefined,
}

export const createNoteSlice: StateCreator<NoteStore> = (set, get) => ({
  ...initNoteState,
  beginNoteSession: (key, note) => {
    if (get().noteSession?.key === key) return
    set({
      mutateNoteData: note,
      noteSession: {key, identity: crypto.randomUUID(), baseline: note ?? {}},
      editorCharCount: {},
    })
  },
  setMutateNoteData: (newData) =>
    set({
      mutateNoteData: newData
        ? Object.assign({}, get().mutateNoteData, newData)
        : undefined,
      ...(!newData ? {noteSession: undefined, editorCharCount: {}} : {}),
    }),
  setEditorCharCount: (editorId, charCount) =>
    set(({editorCharCount}) => ({
      editorCharCount: {...editorCharCount, [editorId]: charCount},
    })),
  resetNoteStore: () => set(() => initNoteState),
})
