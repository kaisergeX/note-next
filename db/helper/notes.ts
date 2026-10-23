import 'server-only'

import {db} from '..'
import {createNoteRepository} from '../repositories/notes'

// Note bodies and lifecycle visibility are read fresh. The former long-lived
// detail cache could otherwise serve an active snapshot after a trash transition.
// Keep tags at the action boundary for route refreshes and future bounded caches.
export const noteRepository = createNoteRepository(db)
export const {getListNote, getNote} = noteRepository
