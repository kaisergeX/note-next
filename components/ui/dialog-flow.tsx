'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import ConfirmationDialog, {
  type ConfirmationDialogProps,
} from './confirmation-dialog'

export type DialogFlowDestination = string | null
type ScreenProps = Omit<ConfirmationDialogProps, 'onAfterClose'> & {
  step: string
}
type Screen = {
  id: string
  parent: string | null
  props: ScreenProps
  order: number
  revision: number
  detached: boolean
  trigger: Element | null
}
type Handoff = {
  owner: string
  revision: number
  destination?: DialogFlowDestination
  error?: ReactNode
}
type HandoffRecovery = {retry: () => void; cancel: () => void}
type Flow = {
  present: (id: string, parent: string | null, props: ScreenProps) => void
  remove: (id: string) => void
  cancelHandoff: () => void
  handoff: (
    prepare: () => Promise<DialogFlowDestination>,
    renderError: (recovery: HandoffRecovery) => ReactNode,
  ) => Promise<void>
}
const FlowContext = createContext<Flow | null>(null)
const ParentContext = createContext<string | null>(null)

/** Keep this provider above loading/route branches that replace flow screens. */
export function DialogFlowProvider({children}: {children: ReactNode}) {
  const [view, setView] = useState<{
    screens: Screen[]
    active?: string
    open: boolean
    pending: boolean
    error?: ReactNode
  }>({screens: [], open: false, pending: false})
  const registry = useRef(new Map<string, Screen>())
  const handoff = useRef<Handoff | undefined>(undefined)
  const sequence = useRef(0)
  const connected = useRef(true)
  const previousActive = useRef<Screen | undefined>(undefined)
  const errorId = useId()
  useLayoutEffect(() => {
    connected.current = true
    return () => {
      connected.current = false
      handoff.current = undefined
      registry.current.clear()
    }
  }, [])

  const flow = useMemo<Flow>(() => {
    const attached = (screen: Screen): boolean => {
      if (screen.detached) return false
      if (!screen.parent) return true
      const parent = registry.current.get(screen.parent)
      return Boolean(parent && attached(parent))
    }
    const removeTree = (id: string) => {
      registry.current.delete(id)
      for (const screen of registry.current.values())
        if (screen.parent === id) removeTree(screen.id)
    }
    const publish = () => {
      if (!connected.current) return
      const pending = handoff.current
      if (pending && pending.destination !== undefined) {
        const ready = [...registry.current.values()].some(
          (screen) =>
            attached(screen) &&
            screen.props.step === pending.destination &&
            screen.revision > pending.revision,
        )
        if (pending.destination === null || ready) {
          handoff.current = undefined
          if (pending.destination === null) removeTree(pending.owner)
          for (const screen of registry.current.values())
            if (screen.detached) removeTree(screen.id)
        }
      }
      const screens = [...registry.current.values()]
      const active =
        handoff.current?.owner ??
        screens.filter(attached).sort((a, b) => b.order - a.order)[0]?.id
      setView((previous) =>
        active
          ? {
              screens,
              active,
              open: true,
              pending: Boolean(handoff.current),
              error: handoff.current?.error,
            }
          : {...previous, open: false, pending: false},
      )
    }
    const cancelHandoff = () => {
      if (!handoff.current) return
      handoff.current.destination = null
      publish()
    }
    async function performHandoff(
      prepare: () => Promise<DialogFlowDestination>,
      renderError: (recovery: HandoffRecovery) => ReactNode,
    ) {
      if (handoff.current && !handoff.current.error) return
      const owner = handoff.current
        ? registry.current.get(handoff.current.owner)
        : [...registry.current.values()]
            .filter(attached)
            .sort((a, b) => b.order - a.order)[0]
      if (!owner) return
      const pending: Handoff = {owner: owner.id, revision: sequence.current}
      handoff.current = pending
      publish()
      try {
        const destination = await prepare()
        if (handoff.current !== pending) return
        pending.destination = destination
      } catch {
        if (handoff.current === pending)
          pending.error = renderError({
            retry: () => void performHandoff(prepare, renderError),
            cancel: () => {
              if (handoff.current === pending) cancelHandoff()
            },
          })
      } finally {
        publish()
      }
    }
    return {
      present(id, parent, props) {
        if (parent && !registry.current.has(parent)) return
        const previous = registry.current.get(id)
        const revision = ++sequence.current
        registry.current.set(id, {
          id,
          parent,
          props,
          order: previous?.order ?? revision,
          revision,
          detached: false,
          trigger: previous?.trigger ?? document.activeElement,
        })
        publish()
      },
      remove(id) {
        const screen = registry.current.get(id)
        if (!screen) return
        if (handoff.current) screen.detached = true
        else removeTree(id)
        publish()
      },
      cancelHandoff,
      handoff: performHandoff,
    }
  }, [])
  const active = view.screens.find((screen) => screen.id === view.active)
  const finishClose = useCallback(() => {
    setView((previous) =>
      previous.open ? previous : {screens: [], open: false, pending: false},
    )
  }, [])
  useEffect(() => {
    const previous = previousActive.current
    previousActive.current = view.open ? active : undefined
    if (!view.open || !active || previous?.parent !== active.id) return
    const trigger = previous.trigger
    if (
      trigger instanceof HTMLElement &&
      trigger !== document.body &&
      trigger !== document.documentElement &&
      trigger.isConnected &&
      trigger.getClientRects().length &&
      !trigger.matches(':disabled')
    )
      trigger.focus()
    else if (!active.props.initialFocusId) {
      const pane = document.getElementById(active.id)
      const target = Array.from(
        pane?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], [tabindex="0"], [contenteditable="true"]',
        ) ?? [],
      ).find((element) => element.getClientRects().length)
      target?.focus()
    }
  }, [active, view.open])
  useEffect(() => {
    if (view.error)
      document
        .getElementById(errorId)
        ?.querySelector<HTMLElement>('button')
        ?.focus()
  }, [view.error, errorId])

  return (
    <FlowContext.Provider value={flow}>
      {children}
      {active && (
        <ConfirmationDialog
          {...active.props}
          open={view.open}
          busy={view.error ? false : view.pending || active.props.busy}
          onAfterClose={finishClose}
          onRequestClose={() => {
            if (view.error) flow.cancelHandoff()
            else active.props.onRequestClose()
          }}
        >
          {view.error && (
            <div id={errorId} role="alert" className="shrink-0 px-4 py-3">
              {view.error}
            </div>
          )}
          {view.screens.map((screen) => (
            <ParentContext.Provider key={screen.id} value={screen.id}>
              <div
                id={screen.id}
                hidden={screen.id !== view.active}
                inert={!view.open || view.pending || screen.id !== view.active}
                className={screen.id === view.active ? 'contents' : 'hidden'}
              >
                {screen.props.children}
              </div>
            </ParentContext.Provider>
          ))}
        </ConfirmationDialog>
      )}
    </FlowContext.Provider>
  )
}

export function useDialogFlow() {
  const flow = useContext(FlowContext)
  if (!flow) throw new Error('DialogFlow requires a DialogFlowProvider')
  return flow
}

/** Screens share the provider's native dialog; changing screens never closes it. */
export default function DialogFlow(props: ScreenProps) {
  const flow = useDialogFlow()
  const parent = useContext(ParentContext)
  const id = useId()
  useLayoutEffect(() => {
    if (props.open) flow.present(id, parent, props)
    else flow.remove(id)
  })
  useLayoutEffect(() => () => flow.remove(id), [flow, id])
  return null
}
