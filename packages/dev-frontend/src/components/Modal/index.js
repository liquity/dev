import classes from "./Modal.module.css";

const Modal = ({ title, content, actions = [], children, onClose }) => (
  <div className={classes.overlay} onClick={onClose}>
    <div className={classes.wrapper} onClick={e => e.stopPropagation()}>
      <h3 className={classes.title}>{title}</h3>
      {children}
    </div>
  </div>
);

export default Modal;
