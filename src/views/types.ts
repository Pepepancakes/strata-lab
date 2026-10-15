import type { ComponentType } from 'react'

export type Region = 'controls' | 'section' | 'well' | 'right'

export interface ViewDefinition {
  id: string
  title: string
  region: Region
  /** Lower first within a region. */
  order: number
  component: ComponentType
}
