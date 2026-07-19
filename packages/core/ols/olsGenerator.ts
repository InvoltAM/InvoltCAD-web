import { Plan } from '../model/Plan'
import { Device } from '../model/Device'
import { Cable } from '../model/Cable'

export interface OlsNode {
  id: string
  type: 'input' | 'panel' | 'group' | 'consumer'
  label: string
  x: number
  y: number
  parentId?: string
}

export interface OlsEdge {
  id: string
  from: string
  to: string
  cableType: string
  crossSection: number
  length: number
}

export interface OlsSchema {
  nodes: OlsNode[]
  edges: OlsEdge[]
}

/**
 * Генерация однолинейной схемы (ОЛС) из плана.
 */
export function generateOls(plan: Plan): OlsSchema {
  const nodes: OlsNode[] = []
  const edges: OlsEdge[] = []

  // Узел ввода
  const inputNode: OlsNode = {
    id: 'input',
    type: 'input',
    label: 'Ввод',
    x: 50,
    y: 50,
  }
  nodes.push(inputNode)

  // Узел щита
  const panelNode: OlsNode = {
    id: 'panel',
    type: 'panel',
    label: 'Щит',
    x: 50,
    y: 150,
    parentId: 'input',
  }
  nodes.push(panelNode)

  // Группы по типам устройств
  const deviceGroups = new Map<string, Device[]>()
  for (const device of plan.devices) {
    const groupKey = device.type.startsWith('socket') ? 'sockets' : device.type === 'light' ? 'lighting' : 'power'
    if (!deviceGroups.has(groupKey)) {
      deviceGroups.set(groupKey, [])
    }
    deviceGroups.get(groupKey)!.push(device)
  }

  let groupY = 250
  let groupX = 50

  // Узлы групп
  for (const [groupKey, devices] of deviceGroups) {
    const groupNode: OlsNode = {
      id: `group-${groupKey}`,
      type: 'group',
      label: groupKey === 'sockets' ? 'Розетки' : groupKey === 'lighting' ? 'Освещение' : 'Силовое',
      x: groupX,
      y: groupY,
      parentId: 'panel',
    }
    nodes.push(groupNode)

    // Ребро от щита к группе
    edges.push({
      id: `edge-panel-${groupKey}`,
      from: 'panel',
      to: `group-${groupKey}`,
      cableType: 'power',
      crossSection: 2.5,
      length: 0,
    })

    // Узлы потребителей в группе
    let consumerY = groupY + 80
    for (const device of devices) {
      const consumerNode: OlsNode = {
        id: `consumer-${device.id}`,
        type: 'consumer',
        label: device.name,
        x: groupX + 100,
        y: consumerY,
        parentId: `group-${groupKey}`,
      }
      nodes.push(consumerNode)

      // Ребро от группы к потребителю
      edges.push({
        id: `edge-${groupKey}-${device.id}`,
        from: `group-${groupKey}`,
        to: `consumer-${device.id}`,
        cableType: 'power',
        crossSection: 2.5,
        length: 0,
      })

      consumerY += 60
    }

    groupX += 250
    if (groupX > 800) {
      groupX = 50
      groupY += 400
    }
  }

  return { nodes, edges }
}
