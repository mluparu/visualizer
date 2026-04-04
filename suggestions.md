# Recommended Libraries for Directed Graph Visualizations (Task Execution)

Based on industry standards and the `agentviz` reference implementation, here are the top recommendations for building a TypeScript-based visualizer for AI agent or task execution workflows.

## 1. Core Layout Engine: **ELKjs** (Eclipse Layout Kernel)
For task execution, the "Layered" layout (DAG) is the most readable. ELKjs is the gold standard for calculating these positions.
*   **Best For:** Automatic node positioning, minimizing edge crossings, and handling nested "sub-graphs" (e.g., tool calls inside a turn).
*   **Usage:** It is a headless library—you provide a JSON of nodes/edges, and it returns the same with `x` and `y` coordinates.
*   **Reference:** Used in `agentviz/src/lib/graphLayout.js`.

## 2. Rendering & UI Frameworks

### **React Flow** (Recommended for Rapid UI Development)
The most popular library for interactive node-based UIs in React.
*   **Pros:** Handles zooming, panning, dragging, and selection out-of-the-box. Extremely easy to create custom "Task Nodes" using standard React components.
*   **Cons:** Can become heavy if you have thousands of nodes; requires some configuration to work perfectly with ELKjs for automatic layout.

### **Plain SVG + D3.js** (Recommended for High Performance/Customization)
The approach used in the `agentviz` project for maximum control.
*   **Pros:** Total control over animations (e.g., flowing dots on edges, "pulsing" active nodes), extremely lightweight, and no "framework" constraints.
*   **Cons:** You must manually implement zooming, panning, and interaction logic (see `agentviz/src/components/GraphView.jsx`).

### **X6 (AntV)** (Recommended for Workflow Editors)
A feature-rich graph editing engine from the AntV ecosystem.
*   **Pros:** Excellent for "Ports" (connecting specific inputs/outputs on a task) and has a very polished, professional look.
*   **Cons:** Steeper learning curve than React Flow.

## 3. Supporting Libraries
*   **Lucide React:** For consistent, lightweight iconography (Task types, Agent types, Status).
*   **Framer Motion:** If using React, this is excellent for animating node transitions when the layout updates (e.g., when a "Turn" expands).

---

## Architectural Recommendation
For a professional **Task Execution Visualizer**:

1.  **State Management:** Use a hook to manage the "Execution Log" (turns, tool calls, status).
2.  **Layout Service:** Pass the execution log to **ELKjs** to calculate the DAG structure whenever a new task is added or a node is expanded.
3.  **View Layer:** Render the resulting coordinates using **React Flow** for the UI infrastructure, or **Plain SVG** if you need high-fidelity custom animations like those in `agentviz`.
