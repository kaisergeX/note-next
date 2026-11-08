'use client'

import {useCallback, useLayoutEffect, useRef, useState} from 'react'
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
    setNative(
      CSS.supports('display', 'grid-lanes') ||
        CSS.supports('grid-template-rows', 'masonry'),
    )
    const measure = () => {
      const style = getComputedStyle(element)
      const tracks = style.gridTemplateColumns.split(' ')
      const next = {
        lanes: tracks.length,
        width: parseFloat(tracks[0]) || element.clientWidth,
        gap: parseFloat(style.columnGap) || 0,
        top: element.getBoundingClientRect().top + window.scrollY,
      }
      setGeometry((old) =>
        Object.keys(next).every(
          (key) =>
            old[key as keyof typeof old] === next[key as keyof typeof next],
        )
          ? old
          : next,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
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
    if (previousWidth.current && previousWidth.current !== geometry.width)
      virtualizer.measure()
    previousWidth.current = geometry.width
  }, [geometry.width, virtualizer])
  return {containerRef, native, geometry, virtualizer, focused, setFocused}
}
