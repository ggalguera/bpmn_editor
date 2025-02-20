import BpmnModeler from 'bpmn-js/lib/Modeler';
// Import your CSS files
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import { layoutProcess } from 'bpmn-auto-layout';
import './styles.css';

// Add event listeners
document.getElementById('newDiagram').addEventListener('click', newDiagram);
document.getElementById('loadDiagram').addEventListener('click', loadDiagram);
document.getElementById('saveDiagram').addEventListener('click', saveDiagram);
document.getElementById('exportDiagram').addEventListener('click', exportDiagram);
document.getElementById('formatCustomProperties').addEventListener('click', formatCustomProperties);
document.getElementById('loadLucidCSV').addEventListener('click', loadLucidCSV);
document.getElementById('saveProperties').addEventListener('click', saveProperties);
document.getElementById('resetProperties').addEventListener('click', resetProperties);
document.getElementById('autoLayout').addEventListener('click', applyAutoLayout);

const modeler = new BpmnModeler({
  container: '#canvas',
  height: '100%',
  width: '100%'
});

// Load default BPMN diagram
const defaultDiagram = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
  xmlns:custom="http://custom/ns"
  id="Definitions_1" 
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="79" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// Initialize diagram
async function initializeDiagram() {
  try {
    const savedDiagram = localStorage.getItem('bpmnDiagram');
    
    if (savedDiagram) {
      await modeler.importXML(savedDiagram);
      console.log('Saved diagram restored successfully');
    } else {
      await modeler.importXML(defaultDiagram);
      console.log('Default diagram loaded');
    }

    const canvas = modeler.get('canvas');
    canvas.zoom('fit-viewport');
    startAutosave();
  } catch (err) {
    console.error('Error during initialization:', err);
    try {
      await modeler.importXML(defaultDiagram);
    } catch (defaultErr) {
      console.error('Critical error: Could not load default diagram', defaultErr);
    }
  }
}

async function applyAutoLayout() {
  try {
    // Get current diagram XML
    const { xml } = await modeler.saveXML({ format: true });
    
    // Apply auto layout
    const layoutedXml = await layoutProcess(xml);
    
    // Import the layouted XML
    await modeler.importXML(layoutedXml);
    
    // Adjust viewport
    const canvas = modeler.get('canvas');
    canvas.zoom('fit-viewport');
    
    showMessage('Auto-layout applied successfully', 'success');
  } catch (err) {
    console.error('Error applying auto-layout:', err);
    showMessage('Error applying auto-layout', 'error');
  }
}

// Start autosave functionality
function startAutosave() {
  if (window.autosaveInterval) {
    clearInterval(window.autosaveInterval);
  }

  window.autosaveInterval = setInterval(async () => {
    try {
      const { xml } = await modeler.saveXML({ format: true });
      localStorage.setItem('bpmnDiagram', xml);
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, 5000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeDiagram);

// Single beforeunload handler
window.addEventListener('beforeunload', async (event) => {
  try {
    const { xml } = await modeler.saveXML({ format: true });
    localStorage.setItem('bpmnDiagram', xml);
    console.log('Final save before unload successful');
  } catch (err) {
    console.error('Error during final save:', err);
  }
});

let selectedElement = null;
let originalProperties = {};

// Handle element selection
modeler.on('element.click', function(event) {
  selectedElement = event.element;
  updateProperties(selectedElement);
  storeOriginalProperties();
});

function storeOriginalProperties() {
  if (!selectedElement) return;
  
  const customProps = {};
  Object.entries(selectedElement.businessObject.$attrs || {}).forEach(([key, value]) => {
    if (key.startsWith('custom:')) {
      const propName = key.replace('custom:', '');
      customProps[propName] = value;
    }
  });

  originalProperties = {
    name: selectedElement.businessObject.name || '',
    description: selectedElement.businessObject.documentation?.[0]?.text || '',
    customProperties: JSON.stringify(customProps, null, 2)
  };
}

function updateProperties(element) {
  if (!element) return;

  const elementId = document.getElementById('elementId');
  const elementType = document.getElementById('elementType');
  const elementName = document.getElementById('elementName');
  const elementDescription = document.getElementById('elementDescription');
  const customProperties = document.getElementById('customProperties');

  if (elementId) elementId.value = element.id || '';
  if (elementType) elementType.value = element.type || '';
  if (elementName) elementName.value = element.businessObject.name || '';
  if (elementDescription) {
    elementDescription.value = element.businessObject.documentation?.[0]?.text || '';
  }

  if (customProperties) {
    const customProps = {};
    Object.entries(element.businessObject.$attrs || {}).forEach(([key, value]) => {
      if (key.startsWith('custom:')) {
        const propName = key.replace('custom:', '');
        customProps[propName] = value;
      }
    });
    customProperties.value = JSON.stringify(customProps, null, 2);
  }
}

function validateProperties() {
  const name = document.getElementById('elementName').value;
  const customPropsField = document.getElementById('customProperties');

  if (!name.trim()) {
    showMessage('Name is required', 'error');
    return false;
  }

  try {
    JSON.parse(customPropsField.value);
    customPropsField.style.border = ""; // Reset border if valid
  } catch (e) {
    showMessage('Invalid JSON in custom properties: ' + e.message, 'error');
    customPropsField.style.border = "2px solid red";
    return false;
  }

  return true;
}

function saveProperties() {
  if (!selectedElement || !validateProperties()) return;

  const modeling = modeler.get('modeling');
  const moddle = modeler.get('moddle');
  
  try {
    const name = document.getElementById('elementName').value;
    const description = document.getElementById('elementDescription').value;
    
    let documentation = undefined;
    if (description) {
      documentation = moddle.create('bpmn:Documentation', {
        text: description
      });
    }

    modeling.updateProperties(selectedElement, {
      name: name,
      documentation: documentation ? [documentation] : undefined
    });

    try {
      const customProps = JSON.parse(document.getElementById('customProperties').value);
      const customAttributes = {};
      Object.entries(customProps).forEach(([key, value]) => {
        customAttributes[`custom:${key}`] = value.toString();
      });
      modeling.updateProperties(selectedElement, customAttributes);
    } catch (e) {
      console.warn('Error parsing custom properties:', e);
    }

    showMessage('Properties saved successfully', 'success');
    storeOriginalProperties();
  } catch (error) {
    console.error('Error saving properties:', error);
    showMessage('Error saving properties: ' + error.message, 'error');
  }
}

function resetProperties() {
  if (!selectedElement) return;
  
  document.getElementById('elementName').value = originalProperties.name;
  document.getElementById('elementDescription').value = originalProperties.description;
  document.getElementById('customProperties').value = originalProperties.customProperties;
}

// Basic diagram operations
async function newDiagram() {
  try {
    await modeler.importXML(defaultDiagram);
    showMessage('New diagram created successfully', 'success');
  } catch (err) {
    showMessage('Error creating new diagram', 'error');
    console.error('Error creating new diagram', err);
  }
}

function loadDiagram() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.bpmn';
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await modeler.importXML(e.target.result);
        showMessage('Diagram loaded successfully', 'success');
      } catch (err) {
        showMessage('Error loading diagram', 'error');
        console.error('Error loading diagram', err);
      }
    };
    reader.readAsText(file);
  };
  fileInput.click();
}



function download(content, fileName, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}


function formatCustomProperties() {
  const customPropsField = document.getElementById('customProperties');
  try {
    const parsedJson = JSON.parse(customPropsField.value);
    customPropsField.value = JSON.stringify(parsedJson, null, 2);
  } catch (e) {
    showMessage('Invalid JSON, cannot format', 'error');
  }
}

// Drag and drop functionality
document.addEventListener('dragover', (event) => {
  event.preventDefault();
});

document.addEventListener('drop', async (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];

  if (file && file.name.endsWith('.bpmn')) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await modeler.importXML(e.target.result);
        showMessage('Diagram loaded successfully', 'success');
      } catch (err) {
        showMessage('Error loading diagram', 'error');
        console.error('Error loading diagram', err);
      }
    };
    reader.readAsText(file);
  }
});

function showMessage(message, type) {
  const messageArea = document.getElementById('messageArea');
  messageArea.textContent = message;
  messageArea.className = type;
  messageArea.style.display = 'block';
  setTimeout(() => {
    messageArea.style.display = 'none';
  }, 3000);
}

// CSV Import functionality
function parseLucidCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return headers.reduce((obj, header, i) => {
      obj[header] = values[i] || '';
      return obj;
    }, {});
  });
  return rows;
}

function parseCustomProperties(comments) {
  if (!comments) return {};
  
  try {
    const pairs = comments.match(/\[(.*?)\]/g);
    if (!pairs) return {};
    
    const properties = {};
    pairs.forEach(pair => {
      const parts = pair.slice(1, -1).split(';').map(p => p.trim());
      
      parts.forEach(part => {
        const [key, value] = part.split(':').map(s => s.trim());
        if (key && value) {
          if (key === 'Input' && value.includes('=')) {
            const inputObj = {};
            const [inputKey, inputValue] = value.split('=').map(s => s.trim().replace(/"/g, ''));
            inputObj[inputKey] = inputValue;
            properties[key] = inputObj;
          } else {
            properties[key] = value.replace(/"/g, '');
          }
        }
      });
    });
    return properties;
  } catch (error) {
    console.error('Error parsing custom properties:', error);
    return {};
  }
}

function createGraph(shapes, connections) {
  const graph = new Map();
  
  // Initialize graph with shapes
  shapes.forEach(shape => {
    if (!graph.has(shape.id)) {
      graph.set(shape.id, {
        shape,
        prev: [],
        next: [],
        level: -1
      });
    }
  });
  
  // Add connections with validation
  connections.forEach(conn => {
    const sourceId = `Shape_${conn['Line Source']}`;
    const targetId = `Shape_${conn['Line Destination']}`;
    
    if (graph.has(sourceId) && graph.has(targetId)) {
      const sourceNode = graph.get(sourceId);
      const targetNode = graph.get(targetId);
      
      sourceNode.next.push(targetId);
      targetNode.prev.push(sourceId);
    } else {
      console.warn(`Invalid connection between ${sourceId} and ${targetId}`);
    }
  });
  
  return graph;
}

async function saveDiagram() {
  try {
    const { xml } = await modeler.saveXML({ format: true });
    localStorage.setItem('bpmnDiagram', xml);
    showMessage('Diagram saved to browser storage', 'success');
  } catch (err) {
    showMessage('Error saving diagram', 'error');
    console.error('Error saving diagram', err);
  }
}

// Export functionality
async function exportDiagram() {
  try {
    const { xml } = await modeler.saveXML({ format: true });
    download(xml, 'diagram.bpmn', 'application/xml');
    showMessage('Diagram exported as file', 'success');
  } catch (err) {
    showMessage('Error exporting diagram', 'error');
    console.error('Error exporting diagram', err);
  }
}

function loadLucidCSV() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.csv';
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csv = e.target.result;
      await importLucidCSV(csv);
    };
    reader.readAsText(file);
  };
  fileInput.click();
}

async function importLucidCSV(csvContent) {
  try {
    const bpmnXML = convertToBPMN(csvContent);
    await modeler.importXML(bpmnXML);
    
    // Apply auto layout after import
    // await applyAutoLayout();
    
    showMessage('Lucid CSV imported successfully', 'success');

  } catch (error) {
    console.error('Error importing Lucid CSV:', error);
    showMessage('Error importing Lucid CSV', 'error');
  }
}

function validateConnections(shapes, connections) {
  const validConnections = connections.filter(conn => {
    const sourceExists = shapes.some(s => s.id === `Shape_${conn['Line Source']}`);
    const targetExists = shapes.some(s => s.id === `Shape_${conn['Line Destination']}`);
    
    if (!sourceExists || !targetExists) {
      console.warn(`Invalid connection ${conn.Id}: source or target missing`);
      return false;
    }
    return true;
  });
  return validConnections;
}

function assignLevels(graph) {
  // Find the leftmost node (start node)
  const start = Array.from(graph.entries()).find(([_, data]) => data.prev.length === 0);
  if (!start) return;
  
  const queue = [{id: start[0], level: 0}];
  const visited = new Set();
  
  // Assign levels from left to right
  while (queue.length > 0) {
    const {id, level} = queue.shift();
    if (visited.has(id)) continue;
    
    visited.add(id);
    const node = graph.get(id);
    node.level = level;
    
    // Process next nodes (moving right)
    node.next.forEach(nextId => {
      if (!visited.has(nextId)) {
        queue.push({id: nextId, level: level + 1});
      }
    });
  }
  
  // Handle any disconnected nodes
  graph.forEach((data, id) => {
    if (data.level === -1) {
      data.level = 0;
    }
  });
}

function calculateAutoLayout(shapes, connections) {
  // Horizontal spacing between elements (left to right)
  const HORIZONTAL_SPACING = 250;
  // Vertical spacing between parallel elements
  const VERTICAL_SPACING = 150;
  
  const graph = createGraph(shapes, connections);
  assignLevels(graph);
  
  // Group shapes by their levels (columns in left-to-right layout)
  const levels = new Map();
  graph.forEach((data, id) => {
    if (!levels.has(data.level)) {
      levels.set(data.level, []);
    }
    levels.get(data.level).push({id, shape: data.shape});
  });
  
  // Calculate positions for each shape
  levels.forEach((nodes, level) => {
    const totalHeight = nodes.length * VERTICAL_SPACING;
    const startY = -totalHeight / 2; // Center vertically
    
    nodes.forEach((node, index) => {
      const shape = node.shape;
      // Set X position based on level (moving right)
      shape.x = level * HORIZONTAL_SPACING + 100; // Add initial offset
      // Set Y position for vertical distribution
      shape.y = startY + (index * VERTICAL_SPACING) + 100; // Add initial offset
    });
  });
  
  return shapes;
}

function calculateConnectionPoints(sourceShape, targetShape) {
  // Add null checks at the beginning
  if (!sourceShape || !targetShape) {
    return {
      sourcePoint: { x: 0, y: 0 },
      targetPoint: { x: 0, y: 0 }
    };
  }

  const sourceCenter = {
    x: sourceShape.x + (sourceShape.width || 0)/2,
    y: sourceShape.y + (sourceShape.height || 0)/2
  };
  const targetCenter = {
    x: targetShape.x + (targetShape.width || 0)/2,
    y: targetShape.y + (targetShape.height || 0)/2
  };

  // Prefer horizontal connections for left-to-right layout
  let sourcePoint = {
    x: sourceShape.x + sourceShape.width, // Right side of source
    y: sourceCenter.y
  };

  let targetPoint = {
    x: targetShape.x, // Left side of target
    y: targetCenter.y
  };

  // If vertical distance is significant, use vertical connections
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  
  if (Math.abs(dy) > Math.abs(dx)) {
    const midX = sourceCenter.x + dx/2;
    sourcePoint = {x: sourceShape.x + sourceShape.width, y: sourceCenter.y};
    targetPoint = {x: targetShape.x, y: targetCenter.y};
  }

  return {sourcePoint, targetPoint};
}

function convertToBPMN(csvContent) {
  const rows = parseLucidCSV(csvContent);
  const shapes = [];
  const connections = [];
  
  // Initialize connection map with proper structure
  const connectionMap = new Map();
  
  // First pass: Initialize all shapes in the connection map
  rows.forEach(row => {
    if (row.Name !== 'Line' && row.Name !== 'Document' && row.Name !== 'Page') {
      const shapeId = `Shape_${row.Id}`;
      connectionMap.set(shapeId, { incoming: [], outgoing: [] });
    }
  });

  // Second pass: Map connections
  rows.forEach(row => {
    if (row.Name === 'Line') {
      const sourceId = `Shape_${row['Line Source']}`;
      const targetId = `Shape_${row['Line Destination']}`;
      const flowId = `Flow_${row.Id}`;
      
      // Ensure both source and target exist in the map
      if (!connectionMap.has(sourceId)) {
        connectionMap.set(sourceId, { incoming: [], outgoing: [] });
      }
      if (!connectionMap.has(targetId)) {
        connectionMap.set(targetId, { incoming: [], outgoing: [] });
      }
      
      // Add the connections
      connectionMap.get(sourceId).outgoing.push(flowId);
      connectionMap.get(targetId).incoming.push(flowId);
      
      connections.push(row);
    }
  });

  // Create shapes with incoming/outgoing references
  rows.forEach((row, index) => {
    if (row.Name === 'Document' || row.Name === 'Page' || row.Name === 'Line') return;
    
    const shapeId = `Shape_${row.Id}`;
    const shapeConnections = connectionMap.get(shapeId) || { incoming: [], outgoing: [] };
    const customProps = parseCustomProperties(row.comments);
    
    let shape = {
      id: shapeId,
      type: 'unknown',
      name: row['Text Area 1'] || '',
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      incoming: shapeConnections.incoming,
      outgoing: shapeConnections.outgoing,
      customProperties: customProps
    };
    
    switch (row.Name) {
      case 'Terminator':
        if (shapes.length === 0) {
          shape.type = 'bpmn:startEvent';
          shape.width = 36;
          shape.height = 36;
        } else {
          shape.type = 'bpmn:endEvent';
          shape.width = 36;
          shape.height = 36;
        }
        break;
      case 'Process':
        shape.type = 'bpmn:task';
        break;
      case 'Decision':
        shape.type = 'bpmn:exclusiveGateway';
        shape.width = 50;
        shape.height = 50;
        break;
      case 'Note':
        shape.type = 'bpmn:textAnnotation';
        shape.width = 120;
        shape.height = 30;
        break;
    }
    
    shapes.push(shape);
  });

  // Auto-layout the shapes
  const layoutedShapes = calculateAutoLayout(shapes, connections);
  
  // Create references before generating XML
  createConnectionReferences(shapes, connections);

  // Validate connections before generating XML
  const validConnections = validateConnections(shapes, connections);

  // Generate BPMN XML with validated connections
  const bpmnXML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:custom="http://custom/ns"
  id="Definitions_1" 
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    ${shapes.map(shape => `
      <${shape.type} id="${shape.id}" name="${shape.name || ''}">${
        shape.incoming.map(ref => `
          <bpmn:incoming>${ref}</bpmn:incoming>`).join('')}${
        shape.outgoing.map(ref => `
          <bpmn:outgoing>${ref}</bpmn:outgoing>`).join('')}
      </${shape.type}>`
    ).join('\n    ')}
    
    ${validConnections.map(conn => `
      <bpmn:sequenceFlow 
        id="Flow_${conn.Id}" 
        sourceRef="Shape_${conn['Line Source']}" 
        targetRef="Shape_${conn['Line Destination']}" 
        name="${conn['Text Area 1'] || ''}" />`
    ).join('\n    ')}
  </bpmn:process>
  
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      ${shapes.map(shape => `
        <bpmndi:BPMNShape id="${shape.id}_di" bpmnElement="${shape.id}">
          <dc:Bounds x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" />
        </bpmndi:BPMNShape>`
      ).join('\n      ')}
      
      ${validConnections.map(conn => {
        const sourceShape = shapes.find(s => s.id === `Shape_${conn['Line Source']}`);
        const targetShape = shapes.find(s => s.id === `Shape_${conn['Line Destination']}`);
        
        if (!sourceShape || !targetShape) return '';
        
        const {sourcePoint, targetPoint} = calculateConnectionPoints(sourceShape, targetShape);
        
        return `
        <bpmndi:BPMNEdge id="Flow_${conn.Id}_di" bpmnElement="Flow_${conn.Id}">
          <di:waypoint x="${Math.round(sourcePoint.x)}" y="${Math.round(sourcePoint.y)}" />
          <di:waypoint x="${Math.round(targetPoint.x)}" y="${Math.round(targetPoint.y)}" />
        </bpmndi:BPMNEdge>`;
      }).filter(Boolean).join('\n      ')}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

  return bpmnXML;
}

function createConnectionReferences(shapes, connections) {
  connections.forEach(conn => {
    const sourceId = `Shape_${conn['Line Source']}`;
    const targetId = `Shape_${conn['Line Destination']}`;
    const flowId = `Flow_${conn.Id}`;
    
    const sourceShape = shapes.find(s => s.id === sourceId);
    const targetShape = shapes.find(s => s.id === targetId);
    
    if (sourceShape && targetShape) {
      if (!sourceShape.outgoing) sourceShape.outgoing = [];
      if (!targetShape.incoming) targetShape.incoming = [];
      
      sourceShape.outgoing.push(flowId);
      targetShape.incoming.push(flowId);
    }
  });
}
