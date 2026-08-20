import { Plan, createEmptyElectrical } from '@core/model/Plan'
import { Wall } from '@core/model/Wall'
import { Opening } from '@core/model/Opening'
import { Device, DeviceType } from '@core/model/Device'
import { Cable, CableType } from '@core/model/Cable'
import { Dimension } from '@core/model/Dimension'
import { DrawingPrimitiveType } from '@core/model/DrawingPrimitive'
import { Vector2 } from '@core/geometry/Vector2'
import { TitleBlockVisibility } from '@core/model/Sheet'

export interface SerializedWall {
  id: string
  startX: number
  startY: number
  endX: number
  endY: number
  thickness: number
  arcRadius?: number
  arcClockwise?: boolean
}

export interface SerializedOpening {
  id: string
  wallId: string
  t: number
  width: number
  type: 'door' | 'window'
  height: number
  swingSide: 'left' | 'right'
  openDir: 1 | -1
}

export interface SerializedDevice {
  id: string
  deviceType: string
  name: string
  wallId: string
  t: number
  side: number
  offset: number
  height?: number
  rotation: number
  iconScale?: number
  nameOffset?: { x: number; y: number }
  position?: { x: number; y: number }
}

export interface SerializedCable {
  id: string
  cableType: string
  crossSection: number
  length: number
  totalLength?: number
  route: Array<{ x: number; y: number }>
  fromDeviceId: string
  toDeviceId: string
}

export interface SerializedDimension {
  id: string
  startX: number
  startY: number
  endX: number
  endY: number
  length: number
  text?: string
}

export interface SerializedTableCell {
  row: number
  col: number
  text?: string
  rowSpan?: number
  colSpan?: number
}

export interface SerializedTable {
  rows: number
  cols: number
  cells: SerializedTableCell[]
  columnWidths: number[]
  rowHeights: number[]
  fontSize?: number
}

export interface SerializedPrimitive {
  id: string
  type: DrawingPrimitiveType
  points: Array<{ x: number; y: number }>
  text?: string
  fontSize?: number
  fontFamily?: string
  color?: string
  italic?: boolean
  textAlign?: 'left' | 'center' | 'right'
  table?: SerializedTable
  lineWidth?: number
  lineColor?: string
  lineStyle?: 'solid' | 'dashed' | 'dotted' | 'dashdot'
  fillColor?: string
}

export interface SerializedUnderlay {
  id: string
  dataUrl: string
  position: { x: number; y: number }
  scale: number
  opacity: number
  visible: boolean
  locked: boolean
}

export interface SerializedTitleBlock {
  organization: string
  objectName: string
  drawingName: string
  projectCode: string
  address: string
  section: string
  drawingTitle: string
  stage: string
  sheetNo: string
  sheetTotal: string
  autoNumbering: boolean
  docCode: string
  date: string
  designer: string
  signatureDesigner: string
  checker: string
  signatureChecker: string
  normController: string
  signatureNormController: string
  gip: string
  signatureGip: string
  approver: string
  signatureApprover: string
  reviewer: string
  signatureReviewer: string
  weight: string
  scaleLabel: string
  company: string
  companyLogo: string
  logoWidth?: number
  logoHeight?: number
  show: Record<string, boolean>
}

export interface SerializedPlan {
  walls: SerializedWall[]
  openings: SerializedOpening[]
  devices: SerializedDevice[]
  cables: SerializedCable[]
  dimensions: SerializedDimension[]
  primitives: SerializedPrimitive[]
  electrical: {
    consumers: any[]
    circuits: any[]
    distributionBoards: any[]
    cableRuns: any[]
    priceItems: any[]
    priceWorkItems: any[]
    estimates: any[]
    invoices: any[]
    documents: any[]
    automationConfigs: any[]
    rooms?: any[]
  }
  underlay?: SerializedUnderlay
  titleBlock?: SerializedTitleBlock
}

/**
 * Сериализует Plan из core в формат для сохранения в БД.
 */
export function serializePlan(plan: Plan): SerializedPlan {
  const walls: SerializedWall[] = []
  const openings: SerializedOpening[] = []

  for (const wall of plan.walls) {
    walls.push({
      id: wall.id,
      startX: wall.a.x,
      startY: wall.a.y,
      endX: wall.b.x,
      endY: wall.b.y,
      thickness: wall.thickness,
      arcRadius: wall.arc?.radius,
      arcClockwise: wall.arc?.clockwise,
    })

    for (const opening of wall.openings) {
      openings.push({
        id: opening.id,
        wallId: wall.id,
        t: opening.t,
        width: opening.width,
        type: opening.type,
        height: 2000, // в нашей модели высота не хранится, используем дефолт
        swingSide: opening.swingSide ?? 'left',
        openDir: opening.openDir ?? 1,
      })
    }
  }

  const devices: SerializedDevice[] = plan.devices.map((device) => ({
    id: device.id,
    deviceType: device.type,
    name: device.name,
    wallId: device.wallId,
    t: device.t,
    side: device.side,
    offset: device.offset,
    rotation: device.rotation,
    iconScale: device.iconScale,
    nameOffset: device.nameOffset,
    position: device.position,
  }))

  const cables: SerializedCable[] = plan.cables.map((cable) => ({
    id: cable.id,
    cableType: cable.type,
    crossSection: cable.crossSection,
    length: cable.length,
    totalLength: cable.totalLength,
    route: cable.route.map((p) => ({ x: p.x, y: p.y })),
    fromDeviceId: cable.fromDeviceId,
    toDeviceId: cable.toDeviceId,
  }))

  const dimensions: SerializedDimension[] = plan.dimensions.map((dim) => ({
    id: dim.id,
    startX: dim.a.x,
    startY: dim.a.y,
    endX: dim.b.x,
    endY: dim.b.y,
    length: dim.length,
    text: dim.text,
  }))

  const primitives: SerializedPrimitive[] = plan.primitives.map((primitive) => ({
    id: primitive.id,
    type: primitive.type,
    points: primitive.points.map((p) => ({ x: p.x, y: p.y })),
    text: primitive.text,
    fontSize: primitive.fontSize,
    fontFamily: primitive.fontFamily,
    color: primitive.color,
    italic: primitive.italic,
    textAlign: primitive.textAlign,
    lineWidth: primitive.lineWidth,
    lineColor: primitive.lineColor,
    lineStyle: primitive.lineStyle,
    fillColor: primitive.fillColor,
    table: primitive.table
      ? {
          rows: primitive.table.rows,
          cols: primitive.table.cols,
          cells: primitive.table.cells.map((c) => ({
            row: c.row,
            col: c.col,
            text: c.text,
            rowSpan: c.rowSpan,
            colSpan: c.colSpan,
          })),
          columnWidths: [...primitive.table.columnWidths],
          rowHeights: [...primitive.table.rowHeights],
          fontSize: primitive.table.fontSize,
        }
      : undefined,
  }))

  const tb = plan.activeSheet.titleBlock
  const titleBlock: SerializedTitleBlock = {
    organization: tb.organization,
    objectName: tb.objectName,
    drawingName: tb.drawingName,
    projectCode: tb.projectCode,
    address: tb.address,
    section: tb.section,
    drawingTitle: tb.drawingTitle,
    stage: tb.stage,
    sheetNo: tb.sheetNo,
    sheetTotal: tb.sheetTotal,
    autoNumbering: tb.autoNumbering,
    docCode: tb.docCode,
    date: tb.date,
    designer: tb.designer,
    signatureDesigner: tb.signatureDesigner,
    checker: tb.checker,
    signatureChecker: tb.signatureChecker,
    normController: tb.normController,
    signatureNormController: tb.signatureNormController,
    gip: tb.gip,
    signatureGip: tb.signatureGip,
    approver: tb.approver,
    signatureApprover: tb.signatureApprover,
    reviewer: tb.reviewer,
    signatureReviewer: tb.signatureReviewer,
    weight: tb.weight ?? '',
    scaleLabel: tb.scaleLabel ?? '',
    company: tb.company,
    companyLogo: tb.companyLogo,
    logoWidth: tb.logoWidth,
    logoHeight: tb.logoHeight,
    show: { ...tb.show },
  }

  return {
    walls,
    openings,
    devices,
    cables,
    dimensions,
    primitives,
    electrical: plan.electrical ?? createEmptyElectrical(),
    underlay: plan.activeSheet.underlay,
    titleBlock,
  }
}

/**
 * Десериализует данные из БД в Plan.
 */
export function deserializePlan(data: SerializedPlan): Plan {
  const plan = new Plan()

  // Создаём стены
  const wallMap = new Map<string, Wall>()
  for (const w of data.walls) {
    const wall: Wall = {
      id: w.id,
      a: new Vector2(w.startX, w.startY),
      b: new Vector2(w.endX, w.endY),
      thickness: w.thickness,
      openings: [],
      arc:
        w.arcRadius && w.arcClockwise !== undefined
          ? {
              center: new Vector2(0, 0), // пересчитаем ниже
              radius: w.arcRadius,
              startAngle: 0,
              endAngle: 0,
              clockwise: w.arcClockwise,
            }
          : undefined,
    }
    plan.walls.push(wall)
    wallMap.set(w.id, wall)
  }

  // Создаём проёмы
  for (const o of data.openings) {
    const wall = wallMap.get(o.wallId)
    if (!wall) continue
    const opening: Opening = {
      id: o.id,
      type: o.type,
      wallId: o.wallId,
      t: o.t,
      width: o.width,
      swingSide: o.swingSide,
      openDir: o.openDir,
    }
    wall.openings.push(opening)
  }

  // Создаём устройства
  for (const d of data.devices) {
    const device: Device = {
      id: d.id,
      type: d.deviceType as DeviceType,
      name: d.name,
      wallId: d.wallId,
      t: d.t,
      side: d.side as 1 | -1,
      offset: d.offset,
      rotation: d.rotation,
      iconScale: d.iconScale,
      nameOffset: d.nameOffset,
      position: d.position,
    }
    plan.devices.push(device)
  }

  // Создаём кабели
  for (const c of data.cables) {
    const cable: Cable = {
      id: c.id,
      fromDeviceId: c.fromDeviceId,
      toDeviceId: c.toDeviceId,
      type: c.cableType as CableType,
      crossSection: c.crossSection,
      length: c.length,
      totalLength: c.totalLength,
      route: c.route.map((p) => new Vector2(p.x, p.y)),
    }
    plan.cables.push(cable)
  }

  // Создаём размеры
  for (const d of data.dimensions) {
    const dimension: Dimension = {
      id: d.id,
      a: new Vector2(d.startX, d.startY),
      b: new Vector2(d.endX, d.endY),
      length: d.length,
      text: d.text,
    }
    plan.dimensions.push(dimension)
  }

  // Создаём примитивы рисования
  for (const p of data.primitives ?? []) {
    const primitive = plan.addPrimitive(
      p.type,
      p.points.map((pt) => new Vector2(pt.x, pt.y)),
      p.text,
      p.fontSize,
      p.fontFamily,
      p.color,
      p.italic,
      p.textAlign,
      p.lineWidth,
      p.lineColor,
      p.lineStyle,
      p.fillColor,
    )
    primitive.id = p.id
    if (p.table && primitive.type === 'table') {
      primitive.table = {
        rows: p.table.rows,
        cols: p.table.cols,
        cells: p.table.cells.map((c) => ({
          row: c.row,
          col: c.col,
          text: c.text,
          rowSpan: c.rowSpan,
          colSpan: c.colSpan,
        })),
        columnWidths: [...p.table.columnWidths],
        rowHeights: [...p.table.rowHeights],
        fontSize: p.table.fontSize,
      }
    }
  }

  plan.electrical = data.electrical ?? createEmptyElectrical()
  if (data.underlay) {
    plan.activeSheet.underlay = { ...data.underlay }
  }
  if (data.titleBlock) {
    plan.activeSheet.titleBlock = {
      ...plan.activeSheet.titleBlock,
      ...data.titleBlock,
      show: { ...plan.activeSheet.titleBlock.show, ...(data.titleBlock.show ?? {}) } as TitleBlockVisibility,
    }
  }
  plan.invalidateRooms()
  return plan
}
