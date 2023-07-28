import type {StateCreator} from 'zustand'
import type {NoteStore, NoteStoreState} from '~/types/note'

export const initNoteState: NoteStoreState = {
  editorCharCount: {},
}

export const createNoteSlice: StateCreator<NoteStore> = (set, get) => ({
  ...initNoteState,
  setNoteData: (noteData) => set(() => ({noteData})),
  setMutateNoteData: (newData) =>
    set({
      mutateNoteData: newData
        ? {...get().mutateNoteData, ...newData}
        : undefined,
    }),
  setEditorCharCount: (editorId, charCount) =>
    set(({editorCharCount}) => {
      const newCountPool = structuredClone(editorCharCount)
      newCountPool[editorId] = charCount

      return {
        editorCharCount: newCountPool,
      }
    }),
  resetNoteStore: () => set(() => initNoteState, true),
})
