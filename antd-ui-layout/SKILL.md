---
  name: antd-ui-layout
  description: Enforces the use of UI library layout components (Ant Design) over custom CSS for layout, spacing, and alignment. Should using in project has installed Ant Design library.
---

  ## Ant Design UI layout
  Run this skill when:
  - Writing new components that need layout/spacing
  - Refactoring existing components with custom CSS
  - Reviewing code for layout best practices
  - Need guidance on which Ant Design component to use for layout
  
  ## Command
  ```
  /antd-ui-layout [component-path]
  ```
  
  ## Examples
  ```
  /antd-ui-layout 
  /ant-ui-layout src/components/MyComponent.jsx
  ```
  
  ## Implementation
  
  When this skill is invoked, the AI should:
  
  ### 1. Analyze Layout Requirements
  - Identify what type of layout is needed (grid, flexbox, spacing, alignment)
  - Check if existing custom CSS is being used for layout
  - Determine the appropriate Ant Design components to use
  
  ### 2. Priority Order for Layout Solutions
  
  #### ALWAYS USE ANT DESIGN COMPONENTS FIRST:
  
  **For Grid Layouts:**
  - Use `Row` and `Col` components with `gutter` prop for spacing
  - Use `span` prop for column widths (span={24} for full width)
  - Use `offset` prop for column offsets
  - Example:
  ```jsx
  <Row gutter={[16, 16]}>
    <Col span={12}>Content</Col>
    <Col span={12}>Content</Col>
  </Row>
  ```
  
  **For Flex Layouts:**
  - Use `Flex` component with `justify`, `align`, `gap`, and `wrap` props
  - Use `vertical` prop for flex-direction
  - Example:
  ```jsx
  <Flex justify="space-between" align="center" gap="middle">
    <div>Left</div>
    <div>Right</div>
  </Flex>
  ```
  
  **For Spacing Between Elements:**
  - Use `Space` component with `size` and `direction` props
  - Use `wrap` prop for wrapping items
  - Example:
  ```jsx
  <Space size="middle" wrap>
    <Button>Action 1</Button>
    <Button>Action 2</Button>
  </Space>
  ```
  
  **For Card/Container Layouts:**
  - Use `Card` component with built-in padding
  - Use `Card.Grid` for grid within cards
  - Use `Card.Meta` for structured content
  
  **For List Layouts:**
  - Use `List` component instead of custom ul/li styling
  - Use `List.Item` with `actions` prop for item actions
  
  **For Form Layouts:**
  - Use `Form` with `layout` prop (vertical, horizontal, inline)
  - Use `Form.Item` with `label` and `wrapperCol`/`labelCol` for alignment
  
  ### 3. When Custom CSS is Acceptable (ONLY after trying Ant Design):
  
  Custom CSS should ONLY be used for:
  - Colors and theming (non-layout)
  - Font styles and text decoration
  - Borders and shadows (visual styling)
  - Background images/gradients
  - Animation and transitions
  - Component-specific visual states (hover, active, etc.)
  
  NEVER use custom CSS for:
  - `display: flex` or `display: grid` (use Flex or Row/Col)
  - `gap`, `margin`, `padding` for spacing (use Space or gutter)
  - `justify-content`, `align-items` (use component props)
  - `width`, `height` for layout (use Col span or component props)
  - `position` for layout (use proper component structure)
  
  ### 4. Refactoring Pattern
  
  When refactoring existing custom CSS to Ant Design components:
  
  **Step 1: Identify layout CSS**
  ```scss
  // BAD - Custom CSS
  .container {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }
  ```
  
  **Step 2: Replace with Ant Design component**
  ```jsx
  // GOOD - Ant Design component
  <Flex gap={12} align="center" justify="space-between">
    {children}
  </Flex>
  ```
  
  **Step 3: Remove layout CSS, keep only visual styling**
  ```scss
  // Keep only non-layout CSS
  .container {
    background-color: #f0f0f0;
    border-radius: 8px;
    // Remove all layout-related properties
  }
  ```
  
  ### 5. Common Patterns to Replace
  
  | Custom CSS | Ant Design Replacement |
  |------------|----------------------|
  | `display: flex; gap: X;` | `<Space size={X}>` or `<Flex gap={X}>` |
  | `display: flex; justify-content: space-between;` | `<Row justify="space-between">` or `<Flex justify="space-between">` |
  | `display: grid; grid-template-columns: ...` | `<Row gutter={X}><Col span={X}>` |
  | `margin-bottom: X;` (for spacing) | `<Space direction="vertical" size={X}>` |
  | `padding: X;` (for containers) | `<Card>` or component's built-in padding props |
  | `text-align: center;` (for layout) | `<Row justify="center">` or `<Flex justify="center">` |
  | Custom responsive CSS | Use `Col` responsive props: `xs`, `sm`, `md`, `lg`, `xl`, `xxl` |
  
  ### 6. Code Review Checklist
  
  When reviewing code, check for:
  - [ ] No `display: flex` or `display: grid` in CSS
  - [ ] No `gap`, `margin`, or `padding` used for layout spacing
  - [ ] No `justify-content`, `align-items`, `align-self` in CSS
  - [ ] No custom width percentages (use Col span instead)
  - [ ] All layout handled by Ant Design components
  - [ ] CSS only contains visual styling (colors, borders, etc.)
  
  ### 7. Benefits of This Approach
  
  1. **Consistency**: All layouts follow the same patterns
  2. **Maintainability**: Easier to update spacing/layout globally
  3. **Responsiveness**: Built-in responsive props in Ant Design
  4. **Less CSS**: Reduced custom CSS file size
  5. **Type Safety**: Component props have TypeScript support
  6. **Accessibility**: Ant Design components have built-in a11y features
  
  ## Output Format
  
  When this skill is used, provide:
  1. Analysis of current layout implementation
  2. Specific Ant Design components to use
  3. Code examples showing the transformation
  4. List of CSS properties to remove
  5. Final refactored code
  
  ## Error Prevention
  
  Common mistakes to avoid:
  - Don't mix Ant Design layout with custom flexbox CSS
  - Don't use inline styles for layout (use component props)
  - Don't create wrapper divs just for layout (use Ant Design components directly)
  - Don't use percentage widths when Col span can be used
  - Don't forget gutter prop when spacing is needed between columns
