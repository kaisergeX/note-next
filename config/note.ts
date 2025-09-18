import {DB_TEXT_LIMIT} from './system'

/**
 * Assume that the characters for the HTML tag are double the content.
 *
 * @returns `21845` characters (approximately 3600 Latin words ~ 6 pages)
 */
export const EDITOR_CONTENT_LIMIT = Math.floor(DB_TEXT_LIMIT / 3)

/**
 * Assume that the size will be triple after encryption.
 *
 * @returns `7281` characters (approximately 1200 words ~ 2 pages)
 */
export const EDITOR_CONTENT_ENCRYPT_LIMIT = Math.floor(DB_TEXT_LIMIT / 9)
