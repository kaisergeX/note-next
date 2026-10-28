'use client'

import {useLayoutEffect, useRef} from 'react'

// Use native masonry where available; keep the fallback's DOM order intact.
export function useMasonry<T extends HTMLElement = HTMLDivElement>(
  layoutKey: string,
) {
  const container = useRef<T>(null)
  useLayoutEffect(() => {
    const element = container.current
    if (!element || CSS.supports('grid-template-rows', 'masonry')) return
    const items = Array.from(element.children) as HTMLElement[]
    let frame = 0
    const arrange = () => {
      frame = 0
      const styles = getComputedStyle(element)
      const tracks = styles.gridTemplateColumns.split(' ')
      const width = parseFloat(tracks[0])
      if (!Number.isFinite(width)) return
      const gap = parseFloat(styles.columnGap) || 0
      const bottoms = tracks.map(() => 0)
      for (const item of items) {
        item.style.position = 'absolute'
        item.style.width = `${width}px`
      }
      const heights = items.map((item) => item.getBoundingClientRect().height)
      // Place in source order at the next open column. Top positions never
      // decrease, so visual reading order agrees with keyboard/DOM order.
      items.forEach((item, index) => {
        const column = bottoms.indexOf(Math.min(...bottoms))
        item.style.insetInlineStart = `${column * (width + gap)}px`
        item.style.top = `${bottoms[column]}px`
        bottoms[column] += heights[index] + gap
      })
      element.style.height = `${Math.max(0, ...bottoms) - (items.length ? gap : 0) + parseFloat(styles.paddingBottom)}px`
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(arrange)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(element)
    items.forEach((item) => observer.observe(item))
    arrange()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      element.style.height = ''
      for (const item of items) {
        item.style.position = ''
        item.style.width = ''
        item.style.insetInlineStart = ''
        item.style.top = ''
      }
    }
  }, [layoutKey])
  return container
}
