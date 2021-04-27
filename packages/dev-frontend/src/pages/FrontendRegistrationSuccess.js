import Modal from "../components/Modal";

export const FrontendRegistrationSuccess = ({ onDismiss }) => (
  <Modal
    onClose={onDismiss}
    title="Success!"
    status="success"
    content="Your frontend is now ready to receive LQTY rewards."
    confirm={{ text: "Go to Dashboard", action: () => onDismiss }}
  ></Modal>
);
