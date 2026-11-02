import styles from './canvas.module.css';

interface Props {
  title: React.ReactNode;
  detail: React.ReactNode;
}

// What an empty canvas says: why it is empty, and what to do about it.
const CanvasNotice = ({ title, detail }: Props) => (
  <div className={styles.notice}>
    <p>{title}</p>
    <span>{detail}</span>
  </div>
);

export default CanvasNotice;
