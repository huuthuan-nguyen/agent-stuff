---
  name: react-modal-hook-pattern
  description: Create React modal components with a custom hook pattern. Use when implementing
  button click actions that open popups/modals, dialog workflows, or any UI that needs
  encapsulated open/close state management.
---

  # React Modal Hook Pattern

  A pattern for creating modal dialogs triggered by user actions (button clicks, menu items)
  while keeping state out of parent components.

  ## When to Use

  - Button click opens a confirmation/form modal
  - Action menus that trigger dialogs
  - Any popup that needs to receive context data when opened

  ## Structure
  ```
  ComponentName/
  ├── index.js              # Re-exports
  ├── ComponentName.jsx     # Hook + logic
  └── ComponentNameModal.jsx # Modal UI
  ```
  ## Implementation

  ### 1. Create the Modal UI Component

  ```jsx
  // DuplicateFormularyModal.jsx
  import { Modal, Form, Input } from 'antd';

  const DuplicateFormularyModal = ({ open, formulary, onCancel, onSubmit }) => {
      const [form] = Form.useForm();

      const handleOk = () => {
          form.validateFields().then(values => {
              onSubmit({ ...formulary, ...values });
          });
      };

      return (
          <Modal
              title="Duplicate Formulary"
              open={open}
              onCancel={onCancel}
              onOk={handleOk}
          >
              <Form form={form} initialValues={{ name: formulary?.name }}>
                  <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                      <Input />
                  </Form.Item>
              </Form>
          </Modal>
      );
  };

  export default DuplicateFormularyModal;

  2. Create the Custom Hook

  // ComponentName.jsx
  import { useState } from 'react';
  import ComponentNameModal from './ComponentNameModal';

  export const useComponentName = ({ onSuccess } = {}) => {
      const [open, setOpen] = useState(false);
      const [data, setData] = useState(null);

      const openModal = (contextData) => {
          setData(contextData);
          setOpen(true);
      };

      const closeModal = () => {
          setOpen(false);
          setData(null);
      };

      const handleSubmit = (result) => {
          // API call here
          closeModal();
          onSuccess?.(result);
      };

      const ModalComponent = () => (
          <ComponentNameModal
              open={open}
              data={data}
              onCancel={closeModal}
              onSubmit={handleSubmit}
          />
      );

      return {
          openModal,
          ModalComponent
      };
  };

  3. Usage in Parent Component

  import { useDuplicateFormulary } from './DuplicateFormulary';

  const FormularyList = () => {
      const { openDuplicateModal, DuplicateModal } = useDuplicateFormulary({
          onSuccess: (data) => {
              navigate(`/formulary/${data.id}/edit`);
          }
      });

      return (
          <>
              <Button onClick={() => openDuplicateModal(selectedFormulary)}>
                  Duplicate
              </Button>
              <DuplicateModal />
          </>
      );
  };

  Key Principles

  1. State isolation: Parent doesn't manage open state
  2. Context passing: openModal(data) passes relevant data
  3. Callback injection: onSuccess allows parent to react to completion
  4. Clean API: Returns only what parent needs (trigger + component)

  Variations

  With loading state

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (result) => {
      setLoading(true);
      await api.create(result);
      setLoading(false);
      closeModal();
      onSuccess?.(result);
  };

  return { openModal, ModalComponent, loading };

  With confirmation before close

  const closeModal = () => {
      if (hasUnsavedChanges) {
          Modal.confirm({ onOk: () => setOpen(false) });
      } else {
          setOpen(false);
      }
  };
