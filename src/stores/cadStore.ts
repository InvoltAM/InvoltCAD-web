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
  selectedWallIds: string[]
  selectedOpeningIds: string[]
  selectedDeviceIds: string[]
  selectedCableIds: string[]
  selectedDimensionIds: string[]
  selectedRoomIndices: number[]
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
  orthoMode: boolean
  olsOpen: boolean
  panelEditorOpen: boolean
  projectsOpen: boolean
  roomsOpen: boolean
  estimatesOpen: boolean
  invoicesOpen: boolean
  documentsOpen: boolean
  catalogOpen: boolean
  markingOpen: boolean
  automationOpen: boolean
  templatesOpen: boolean
  cableJournalOpen: boolean

  setTool: (tool: ToolName) => void
  setSelectedWall: (id: string | null) => void
  setSelectedOpening: (id: string | null) => void
  setSelectedDevice: (id: string | null) => void
  setSelectedCable: (id: string | null) => void
  setSelectedDimension: (id: string | null) => void
  setSelectedRoom: (index: number | null) => void
  setSelectedWalls: (ids: string[]) => void
  setSelectedOpenings: (ids: string[]) => void
  setSelectedDevices: (ids: string[]) => void
  setSelectedCables: (ids: string[]) => void
  setSelectedDimensions: (ids: string[]) => void
  setSelectedRooms: (indices: number[]) => void
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
  setOrthoMode: (orthoMode: boolean) => void
  setOlsOpen: (open: boolean) => void
  setPanelEditorOpen: (open: boolean) => void
  setProjectsOpen: (open: boolean) => void
  setRoomsOpen: (open: boolean) => void
  setEstimatesOpen: (open: boolean) => void
  setInvoicesOpen: (open: boolean) => void
  setDocumentsOpen: (open: boolean) => void
  setCatalogOpen: (open: boolean) => void
  setMarkingOpen: (open: boolean) => void
  setAutomationOpen: (open: boolean) => void
  setTemplatesOpen: (open: boolean) => void
  setCableJournalOpen: (open: boolean) => void
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
  selectedWallIds: [],
  selectedOpeningIds: [],
  selectedDeviceIds: [],
  selectedCableIds: [],
  selectedDimensionIds: [],
  selectedRoomIndices: [],
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
  orthoMode: false,
  olsOpen: false,
  panelEditorOpen: false,
  projectsOpen: false,
  roomsOpen: false,
  estimatesOpen: false,
  invoicesOpen: false,
  documentsOpen: false,
  catalogOpen: false,
  markingOpen: false,
  automationOpen: false,
  templatesOpen: false,
  cableJournalOpen: false,

  setTool: (tool) => set({ currentTool: tool }),
  setSelectedWall: (id) => set({ selectedWallId: id }),
  setSelectedOpening: (id) => set({ selectedOpeningId: id }),
  setSelectedDevice: (id) => set({ selectedDeviceId: id }),
  setSelectedCable: (id) => set({ selectedCableId: id }),
  setSelectedDimension: (id) => set({ selectedDimensionId: id }),
  setSelectedRoom: (index) => set({ selectedRoomIndex: index }),
  setSelectedWalls: (ids) => set({ selectedWallIds: ids }),
  setSelectedOpenings: (ids) => set({ selectedOpeningIds: ids }),
  setSelectedDevices: (ids) => set({ selectedDeviceIds: ids }),
  setSelectedCables: (ids) => set({ selectedCableIds: ids }),
  setSelectedDimensions: (ids) => set({ selectedDimensionIds: ids }),
  setSelectedRooms: (indices) => set({ selectedRoomIndices: indices }),
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
  setOrthoMode: (orthoMode) => set({ orthoMode }),
  setOlsOpen: (olsOpen) => set({ olsOpen }),
  setPanelEditorOpen: (panelEditorOpen) => set({ panelEditorOpen }),
  setProjectsOpen: (projectsOpen) => set({ projectsOpen }),
  setRoomsOpen: (roomsOpen) => set({ roomsOpen }),
  setEstimatesOpen: (estimatesOpen) => set({ estimatesOpen }),
  setInvoicesOpen: (invoicesOpen) => set({ invoicesOpen }),
  setDocumentsOpen: (documentsOpen) => set({ documentsOpen }),
  setCatalogOpen: (catalogOpen) => set({ catalogOpen }),
  setMarkingOpen: (markingOpen) => set({ markingOpen }),
  setAutomationOpen: (automationOpen) => set({ automationOpen }),
  setTemplatesOpen: (templatesOpen) => set({ templatesOpen }),
  setCableJournalOpen: (cableJournalOpen) => set({ cableJournalOpen }),
  clearSelection: () =>
    set({
      selectedWallId: null,
      selectedOpeningId: null,
      selectedDeviceId: null,
      selectedCableId: null,
      selectedDimensionId: null,
      selectedRoomIndex: null,
      selectedWallIds: [],
      selectedOpeningIds: [],
      selectedDeviceIds: [],
      selectedCableIds: [],
      selectedDimensionIds: [],
      selectedRoomIndices: [],
    }),
}))
