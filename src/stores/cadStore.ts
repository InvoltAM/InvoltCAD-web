import { create } from 'zustand'
import type { ToolName } from '@core/tools/ToolManager'
import type { DeviceType } from '@core/model/Device'
import type { ValidationIssue } from '@core/rules/ValidationTypes'
import type { ThemeName } from '@core/editor/ThemeManager'
import type { WallJoinStyle } from '@core/editor/EditorState'

export interface DisplayLayers {
  rooms: boolean
  walls: boolean
  openings: boolean
  dimensions: boolean
  wallDimensions: boolean
  devices: boolean
  cables: boolean
}

export interface SnapSettings {
  grid: boolean
  wallLines: boolean
  endpoints: boolean
}

interface CadStoreState {
  currentTool: ToolName
  selectedWallId: string | null
  selectedOpeningId: string | null
  selectedDeviceId: string | null
  selectedCableId: string | null
  selectedDimensionId: string | null
  selectedRoomIndex: number | null
  selectedDeviceType: DeviceType
  zoom: number
  layers: DisplayLayers
  snap: SnapSettings
  wallThickness: number
  doorWidth: number
  windowWidth: number
  defaultCableType: import('@core/model/Cable').CableType
  defaultCableSection: number
  deviceIconScale: number
  wallJoinStyle: WallJoinStyle
  validationIssues: ValidationIssue[]
  showValidation: boolean
  theme: ThemeName
  uiScale: number
  compactPanels: boolean

  setTool: (tool: ToolName) => void
  setSelectedWall: (id: string | null) => void
  setSelectedOpening: (id: string | null) => void
  setSelectedDevice: (id: string | null) => void
  setSelectedCable: (id: string | null) => void
  setSelectedDimension: (id: string | null) => void
  setSelectedRoom: (index: number | null) => void
  setSelectedDeviceType: (type: DeviceType) => void
  setZoom: (zoom: number) => void
  setLayers: (layers: DisplayLayers) => void
  setSnap: (snap: SnapSettings) => void
  setWallThickness: (thickness: number) => void
  setDoorWidth: (width: number) => void
  setWindowWidth: (width: number) => void
  setDefaultCableType: (type: import('@core/model/Cable').CableType) => void
  setDefaultCableSection: (section: number) => void
  setDeviceIconScale: (scale: number) => void
  setWallJoinStyle: (style: WallJoinStyle) => void
  setValidationIssues: (issues: ValidationIssue[]) => void
  setShowValidation: (show: boolean) => void
  setTheme: (theme: ThemeName) => void
  setUiScale: (scale: number) => void
  setCompactPanels: (compact: boolean) => void
  clearSelection: () => void
}

export const useCadStore = create<CadStoreState>((set) => ({
  currentTool: 'wall',
  selectedWallId: null,
  selectedOpeningId: null,
  selectedDeviceId: null,
  selectedCableId: null,
  selectedDimensionId: null,
  selectedRoomIndex: null,
  selectedDeviceType: 'socket',
  zoom: 0.1,
  layers: {
    rooms: true,
    walls: true,
    openings: true,
    dimensions: true,
    wallDimensions: false,
    devices: true,
    cables: true,
  },
  snap: { grid: true, wallLines: true, endpoints: true },
  wallThickness: 200,
  doorWidth: 900,
  windowWidth: 1200,
  defaultCableType: 'power',
  defaultCableSection: 2.5,
  deviceIconScale: 1,
  wallJoinStyle: 'square',
  validationIssues: [],
  showValidation: true,
  theme: 'light',
  uiScale: 1,
  compactPanels: false,

  setTool: (tool) => set({ currentTool: tool }),
  setSelectedWall: (id) => set({ selectedWallId: id }),
  setSelectedOpening: (id) => set({ selectedOpeningId: id }),
  setSelectedDevice: (id) => set({ selectedDeviceId: id }),
  setSelectedCable: (id) => set({ selectedCableId: id }),
  setSelectedDimension: (id) => set({ selectedDimensionId: id }),
  setSelectedRoom: (index) => set({ selectedRoomIndex: index }),
  setSelectedDeviceType: (type) => set({ selectedDeviceType: type }),
  setZoom: (zoom) => set({ zoom }),
  setLayers: (layers) => set({ layers }),
  setSnap: (snap) => set({ snap }),
  setWallThickness: (wallThickness) => set({ wallThickness }),
  setDoorWidth: (doorWidth) => set({ doorWidth }),
  setWindowWidth: (windowWidth) => set({ windowWidth }),
  setDefaultCableType: (defaultCableType) => set({ defaultCableType }),
  setDefaultCableSection: (defaultCableSection) => set({ defaultCableSection }),
  setDeviceIconScale: (deviceIconScale) => set({ deviceIconScale }),
  setWallJoinStyle: (wallJoinStyle) => set({ wallJoinStyle }),
  setValidationIssues: (validationIssues) => set({ validationIssues }),
  setShowValidation: (showValidation) => set({ showValidation }),
  setTheme: (theme) => set({ theme }),
  setUiScale: (uiScale) => set({ uiScale }),
  setCompactPanels: (compactPanels) => set({ compactPanels }),
  clearSelection: () =>
    set({
      selectedWallId: null,
      selectedOpeningId: null,
      selectedDeviceId: null,
      selectedCableId: null,
      selectedDimensionId: null,
      selectedRoomIndex: null,
    }),
}))
