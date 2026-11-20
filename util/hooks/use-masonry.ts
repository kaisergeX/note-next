'use client'

import {useCallback, useLayoutEffect, useRef, useState} from 'react'
import {flushSync} from 'react-dom'
import {
  defaultRangeExtractor,
  useWindowVirtualizer,
} from '@tanstack/react-virtual'
import {useNoteMasonryCache} from '~/components/note/note-query-provider'

export function useMasonry(ids: string[], pinnedId?: string) {
  const containerRef = useRef<HTMLUListElement>(null)
  const [geometry, setGeometry] = useState({
    lanes: 1,
    width: 0,
    gap: 16,
    top: 0,
  })
  const [native, setNative] = useState(false)
  const [focused, setFocused] = useState<string>()
  const cache = useNoteMasonryCache()
  const cacheKey = `${geometry.width}:${ids.join('|')}`
  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    // Measured scroll corrections must be immediate. The app's scroll-smooth
    // rule otherwise starts competing animations while cards change size.
    const root = document.documentElement
    const previousScrollBehavior = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    const supportsNativeMasonry =
      CSS.supports('display', 'grid-lanes') ||
      CSS.supports('grid-template-rows', 'masonry')
    setNative(supportsNativeMasonry)
    const measure = () => {
      const style = getComputedStyle(element)
      const tracks = style.gridTemplateColumns.split(' ')
      return {
        lanes: tracks.length,
        width: parseFloat(tracks[0]) || element.clientWidth,
        gap: parseFloat(style.columnGap) || 0,
        top: element.getBoundingClientRect().top + window.scrollY,
      }
    }
    let previous = measure()
    setGeometry(previous)
    const observer = new ResizeObserver(() => {
      const next = measure()
      const widthChanged =
        next.width !== previous.width || next.lanes !== previous.lanes
      if (
        !widthChanged &&
        next.gap === previous.gap &&
        next.top === previous.top
      )
        return
      previous = next
      // Keep card positions in sync with the CSS tracks before the next paint.
      if (widthChanged && !supportsNativeMasonry)
        flushSync(() => setGeometry(next))
      else setGeometry(next)
    })
    observer.observe(element)
    // Controls above the list can wrap after fonts or filters change.
    if (element.parentElement) observer.observe(element.parentElement)
    return () => {
      observer.disconnect()
      root.style.scrollBehavior = previousScrollBehavior
    }
  }, [])
  const getItemKey = useCallback((index: number) => ids[index], [ids])
  const virtualizer = useWindowVirtualizer({
    count: ids.length,
    enabled: !native && geometry.width > 0,
    lanes: geometry.lanes,
    laneAssignmentMode: 'measured',
    gap: geometry.gap,
    scrollMargin: geometry.top,
    estimateSize: () => 300,
    initialMeasurementsCache: cache.get(cacheKey) ?? [],
    onChange: (instance) => {
      if (geometry.width && !native) {
        if (!cache.has(cacheKey)) cache.clear()
        cache.set(cacheKey, instance.measurementsCache)
      }
    },
    getItemKey,
    overscan: geometry.lanes * 4,
    rangeExtractor: (range) => {
      // Small collections retain ordinary browser find and list transitions.
      if (ids.length <= 72) return ids.map((_, index) => index)
      const indexes = new Set(defaultRangeExtractor(range))
      for (const id of [focused, pinnedId]) {
        const index = id ? ids.indexOf(id) : -1
        // Keep the focused card and its neighbours mounted for native Tab.
        if (index >= 0)
          for (
            let i = Math.max(0, index - 1);
            i <= Math.min(ids.length - 1, index + 1);
            i++
          )
            indexes.add(i)
      }
      return [...indexes].sort((a, b) => a - b)
    },
  })
  // Width changes within the same column count also invalidate card heights.
  const previousWidth = useRef(0)
  useLayoutEffect(() => {
    if (
      !native &&
      previousWidth.current &&
      previousWidth.current !== geometry.width
    ) {
      virtualizer.measure()
      // Width changes invalidate offscreen sizes. Remeasure mounted cards now
      // so their offsets don't use estimates while the observer catches up.
      containerRef.current
        ?.querySelectorAll<HTMLLIElement>(':scope > li')
        .forEach(virtualizer.measureElement)
    }
    previousWidth.current = geometry.width
  }, [geometry.width, native, virtualizer])
  return {containerRef, native, geometry, virtualizer, focused, setFocused}
}
