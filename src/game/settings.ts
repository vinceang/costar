import { createContext, useContext, useEffect, useState } from 'react'
import { setMuted } from '../audio/sfx'

export interface Settings {
  sound: boolean
  motion: 'full' | 'reduced'
}

const KEY = 'costar.settings'

function defaults(): Settings {
  const prefersReduced =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  return { sound: true, motion: prefersReduced ? 'reduced' : 'full' }
}

export function loadSettings(): Settings {
  try {
    return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return defaults()
  }
}

export function useSettingsState() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings))
    setMuted(!settings.sound)
    document.documentElement.dataset.motion = settings.motion
  }, [settings])
  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }))
  return { settings, update }
}

export const SettingsContext = createContext<ReturnType<typeof useSettingsState> | null>(null)

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('SettingsContext missing')
  return ctx
}
