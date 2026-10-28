import type {Command} from '@tiptap/react'

export const insertNoteHorizontalRule: Command = ({state, chain}) => {
  const {empty, $from} = state.selection
  const {horizontalRule} = state.schema.nodes
  if (
    !empty ||
    !$from.parent.isTextblock ||
    !$from.parent.content.size ||
    $from.parentOffset !== $from.parent.content.size ||
    !$from
      .node(-1)
      .canReplaceWith(
        $from.indexAfter(-1),
        $from.indexAfter(-1),
        horizontalRule,
      )
  ) {
    return chain().setHorizontalRule().run()
  }

  // Tiptap 3.32.0's EOL insertion leaves its selection before the HR,
  // causing its follow-up paragraph to be inserted before the rule too.
  const position = $from.after()
  const next = state.doc.resolve(position).nodeAfter
  const content = [{type: 'horizontalRule'}]
  if (!next?.isTextblock) content.push({type: 'paragraph'})

  return chain()
    .insertContentAt(position, content)
    .setTextSelection(position + 2)
    .run()
}
