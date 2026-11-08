'use client'

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import {useMasonry} from '~/util/hooks/use-masonry'
import {useNativeMasonryCache} from './note-query-provider'

// A continuous native grid keeps its lane packing across network pages. Only
// lightweight shells persist offscreen; measured heights preserve their lanes.
function NativeCard({
  id,
  index,
  count,
  pinned,
  width,
  children,
}: {
  id: string
  index: number
  count: number
  pinned: boolean
  width: number
  children: () => ReactNode
}) {
  const ref = useRef<HTMLLIElement>(null)
  const [visible, setVisible] = useState(index < 24)
  const cache = useNativeMasonryCache()
  const cacheKey = `${width}:${id}`
  const [height, setHeight] = useState(() => cache.get(cacheKey) ?? 300)
  const mounted = count <= 72 || visible || pinned
  useLayoutEffect(() => {
    const element = ref.current!
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      {rootMargin: '800px'},
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    if (!mounted) return
    const element = ref.current!
    const observer = new ResizeObserver(() => {
      const height = element.getBoundingClientRect().height
      cache.set(cacheKey, height)
      setHeight(height)
    })
    setHeight(element.getBoundingClientRect().height)
    observer.observe(element)
    return () => observer.disconnect()
  }, [mounted, cache, cacheKey])
  return (
    <li
      ref={ref}
      data-masonry-id={id}
      data-index={index}
      aria-posinset={index + 1}
      aria-setsize={count}
      aria-hidden={!mounted || undefined}
      className="min-w-0"
      style={mounted ? undefined : {height}}
    >
      {mounted && children()}
    </li>
  )
}

export default function NoteMasonry({
  ids,
  renderCard,
  listRef,
  pinnedId,
  onLayout,
}: {
  ids: string[]
  renderCard: (id: string) => ReactNode
  listRef: RefObject<HTMLUListElement | null>
  pinnedId?: string
  onLayout: () => void
}) {
  const {containerRef, native, geometry, virtualizer, focused, setFocused} =
    useMasonry(ids, pinnedId)
  const focusedIndex = focused ? ids.indexOf(focused) : -2
  const pinnedIndex = pinnedId ? ids.indexOf(pinnedId) : -2
  const resizeAnchor = useRef<{id: string; top: number} | undefined>(undefined)
  const lastWidth = useRef(0)
  useLayoutEffect(() => {
    const record = () => {
      const element = containerRef.current
      if (
        element &&
        parseFloat(getComputedStyle(element).gridTemplateColumns) !==
          geometry.width
      )
        return
      const anchor = element?.querySelector<HTMLAnchorElement>(
        `a[data-note-id="${focused ?? pinnedId ?? ''}"]`,
      )
      if (anchor)
        resizeAnchor.current = {
          id: anchor.dataset.noteId!,
          top: anchor.getBoundingClientRect().top,
        }
    }
    let frame = 0
    if (
      lastWidth.current &&
      lastWidth.current !== geometry.width &&
      resizeAnchor.current
    ) {
      const previous = resizeAnchor.current
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          const anchor = containerRef.current?.querySelector<HTMLAnchorElement>(
            `a[data-note-id="${previous.id}"]`,
          )
          if (anchor)
            window.scrollBy({
              top: anchor.getBoundingClientRect().top - previous.top,
              behavior: 'instant',
            })
          record()
        })
      })
    } else record()
    lastWidth.current = geometry.width
    window.addEventListener('scroll', record, {passive: true})
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', record)
    }
  }, [geometry.width, focused, pinnedId, containerRef])
  const totalSize = virtualizer.getTotalSize()
  const offset = virtualizer.scrollOffset ?? 0
  const viewport = virtualizer.scrollRect?.height ?? 0
  // Measured lanes can leave a wide source-index range after a fast jump.
  // Bound card bodies by geometry as well, retaining keyboard neighbours.
  const items = virtualizer
    .getVirtualItems()
    .filter(
      (item) =>
        ids.length <= 72 ||
        Math.abs(item.index - focusedIndex) <= 1 ||
        Math.abs(item.index - pinnedIndex) <= 1 ||
        (item.end >= offset - 800 && item.start <= offset + viewport + 800),
    )
  useLayoutEffect(() => {
    if (!geometry.width) return
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(onLayout)
    })
    return () => cancelAnimationFrame(frame)
  }, [onLayout, geometry.width, totalSize, native])
  return (
    <ul
      ref={(element) => {
        containerRef.current = element
        listRef.current = element
      }}
      data-masonry={native ? 'native' : 'virtual'}
      className="note-grid note-masonry relative grid items-start gap-4 pb-8"
      style={native ? undefined : {height: virtualizer.getTotalSize() + 32}}
      onFocusCapture={(event) =>
        setFocused(
          (event.target as HTMLElement).closest<HTMLElement>(
            '[data-masonry-id]',
          )?.dataset.masonryId,
        )
      }
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(undefined)
      }}
    >
      {native
        ? ids.map((id, index) => (
            <NativeCard
              key={id}
              id={id}
              index={index}
              count={ids.length}
              width={geometry.width}
              pinned={id === pinnedId || Math.abs(index - focusedIndex) <= 1}
            >
              {() => renderCard(id)}
            </NativeCard>
          ))
        : items.map((item) => (
            <li
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              data-masonry-id={ids[item.index]}
              aria-posinset={item.index + 1}
              aria-setsize={ids.length}
              className="absolute top-0 min-w-0"
              style={{
                width: geometry.width,
                insetInlineStart: item.lane * (geometry.width + geometry.gap),
                transform: `translateY(${item.start - geometry.top}px)`,
              }}
            >
              {renderCard(ids[item.index])}
            </li>
          ))}
    </ul>
  )
}
